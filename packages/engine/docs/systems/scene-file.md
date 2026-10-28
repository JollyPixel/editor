# Scene files

A `SceneFile` describes a tree of actors, each with an ordered list of
components, as plain JSON. `FileScene` turns one into live actors through the
component definitions the game registers.

```ts
import {
  Systems,
  CameraDefinition,
  LightDefinition,
  MeshDefinition,
  ScriptDefinition,
  loadJSON
} from "@jolly-pixel/engine";

const components = new Systems.ComponentDefinitions().register(
  new CameraDefinition(),
  new LightDefinition(),
  new MeshDefinition(),
  new ScriptDefinition({ Player: PlayerBehavior })
);

const file = await loadJSON<Systems.SceneFile>("level-1.scene.json");
world.sceneManager.loadScene(
  new Systems.FileScene("Level 1", file, { components })
);
```

Nothing is registered by default: a game ships only the definitions it uses.

## File format

```ts
interface SceneFile {
  version: 1;
  environment: SceneEnvironmentFile;
  actors: SceneActorFile[];
}

interface SceneActorFile {
  id: string;
  name: string;
  parentId: string | null;
  visible: boolean;
  transform: {
    position: Vector3JSON;
    rotation: Vector3JSON; // Euler angles in degrees, XYZ order
    scale: Vector3JSON;
  };
  components: SceneComponentFile[];
  prefab?: AssetReferenceData; // a scene expanded under this actor
}

interface SceneComponentFile {
  id: string;
  type: string;
  data: JSONObject;
  assets: Record<string, AssetReferenceData | null>;
}

interface SceneEnvironmentFile {
  background: ColorJSON | null;
  environment: { kind: "none" | "room"; intensity: number; };
  fog:
    | { kind: "none"; }
    | { kind: "linear"; color: ColorJSON; near: number; far: number; }
    | { kind: "exp2"; color: ColorJSON; density: number; };
}

type ColorJSON = string; // "#rrggbb"
```

- `actors` is in tree order: an actor follows its parent, and siblings follow
  their display order.
- Ids are unique within one file. A built actor takes its file id as its
  `persistentId`, unless an actor pending destruction still holds that id:
  it then gets a new random one.
- The engine reads the decoded form. A file with an identity transform or
  `visible: true` left out must be decoded before it reaches the engine.

## Prefab instances

An actor with `prefab` is an instance of another scene. Its name, visibility
and transform form the instance root, and the root actors of the referenced
scene are built under it, in edit and play mode alike.

```ts
interface ScenePrefabs {
  find(sceneId: string): Readonly<ScenePrefabFile> | null;
}

type ScenePrefabFile = Pick<SceneFile, "actors">;
```

- The engine loads no scene file itself: the game or editor passes a
  `ScenePrefabs` that finds them by asset id. A scene it does not find
  leaves the instance root empty.
- An expanded actor or component gets the path id
  `<instance id>/<id in its scene>`, so several instances of one scene never
  collide. A nested instance adds one segment per level.
- A scene already being expanded on the way down is skipped with a warning,
  so a cycle stops instead of recursing.
- Instances are read-only: nothing writes back to the referenced scene.

`includedSceneFiles(file, prefabs, sceneId?)` yields `file`, then every scene
its instances include, nested ones too, once each. `sceneId` names `file`, so
an instance of it is never yielded again. `NO_SCENE_PREFABS` finds no scene.

## Component definitions

One definition per component `type`:

```ts
interface ComponentDefinition<TData, TComponent extends Component, TAssets> {
  readonly type: string;
  readonly assets?: { [TSlot in keyof TAssets]: AssetType<TAssets[TSlot]> };

  parse(data: Readonly<JSONObject>): TData;
  create(
    actor: Actor,
    data: TData,
    context: ComponentContext<TAssets>
  ): TComponent | null;
  apply?(component: TComponent, data: TData): void;
  owns?(component: Component): component is TComponent;
  capture?(component: TComponent): JSONObject;
}

interface ComponentContext<TAssets> {
  readonly mode: "edit" | "play";
  readonly assets: ComponentAssets<TAssets>;
}
```

- `parse` turns the stored `data` into the definition's data, with a default
  for each missing or mistyped field. `ComponentData` wraps a `JSONObject`
  with `number`, `string`, `boolean`, `color`, `choice` and `object` readers
  that take the fallback. `choice` takes a record keyed by the accepted
  values.
- `create` returns `null` when the mode needs no component, such as a
  script in edit mode.
- `apply` patches a live component with the full data. Without it, a data
  change rebuilds the component.
- `capture` is the inverse of `parse`: it writes the current state of a live
  component as `data`. `owns` tells whether a component the scene file did
  not build is one the definition captures; without it, only the components
  the definition built are captured. `toHexColor(value)` turns any
  `THREE.ColorRepresentation` into the
  `"#rrggbb"` form `ComponentData.color` reads. See
  [Saving a running scene](#saving-a-running-scene).
- `assets` maps each asset slot the component reads to its `AssetType`. The
  filled slots are loaded before the scene activates.
- In edit mode a definition builds nothing that runs the game: the camera
  never renders and no script is built.

A definition for a game's own `Skin` component, which takes a texture:

```ts
const skin: Systems.ComponentDefinition<
  null,
  Skin,
  { texture: THREE.Texture; }
> = {
  type: "Skin",
  assets: { texture: TEXTURE_ASSET },
  parse: () => null,
  create: (actor, _data, context) => actor.addComponentAndGet(Skin, {
    texture: context.assets.resolve("texture")
  })
};
```

### ComponentAssets.resolve(slot): TAssets[slot] | null

Resolves one slot of the component's `assets` map with the type the
definition declares for it. Returns `null` for an empty or missing slot.
`FileScene` resolves through `world.assetCoordinator`
(`CoordinatorAssetResolver`). An editor passes its own
`ComponentAssetResolver` to `SceneInstance`.

### ComponentDefinitions

- `register(...definitions): this` throws when a type is already registered.
- `find(type): ComponentDefinition | null`
- `create(actor, entry, { mode, resolver }): Component | null` builds the
  component of a `SceneComponentFile` and remembers the entry it came from.
  Returns `null` for an unknown type or when the definition builds nothing.
- `apply(component, type, data): boolean` patches a live component through
  its definition's `apply` and remembers `data` as the component's latest.
  Returns `false` when the definition has no `apply`.
- `capture(component): SceneComponentFile | null` writes a live component
  back as a file entry. See
  [Saving a running scene](#saving-a-running-scene).
- `assets(file)` yields the asset references of every known component in the
  file. It reads only `file.actors`.

## FileScene

```ts
class FileScene<TContext> extends Scene<TContext> {
  readonly file: SceneFile;

  constructor(
    name: string,
    file: SceneFile,
    options: {
      components: ComponentDefinitions;
      prefabs?: ScenePrefabs;
      sceneId?: string;
    }
  );

  capture(): SceneFile;
}
```

- Its `assets` are the definitions' assets, loaded by
  [`SceneManager`](scene-manager.md) like any scene. With `prefabs`, they
  include the assets of every scene its instances include, so `prefabs` must
  find each of those scenes when the `FileScene` is constructed.
- `sceneId` is the asset id of `file`. Pass it so a prefab cycle back to this
  scene stops at once, as in the editor, instead of one level down.
- `awake()` builds the actors in play mode and applies the environment.
- `destroy()` resets the background, fog and environment map.

## Saving a running scene

`scene.capture()` returns a `SceneFile` of the world as it is now, with the
environment of the scene's own file. Loading it in a new `FileScene` restores
that state, so a save game is a scene file:

```ts
localStorage.setItem("save", JSON.stringify(scene.capture()));

const save = JSON.parse(localStorage.getItem("save")!) as Systems.SceneFile;
world.sceneManager.loadScene(new Systems.FileScene("Level 1", save, { components }));
```

`captureSceneActors(tree, components)` does the same for any `ActorTree`,
such as `world.sceneManager.tree` under a scene written in code. It returns
the actor files only.

What a capture holds:

- Every actor of the tree that is not pending destruction, in tree order:
  those built from a file, those created at runtime, those of appended
  scenes, and persistent ones. Ids are `actor.persistentId`.
- The local transform, name and visibility of each actor.
- A prefab instance as the actors it expanded, with their path ids and no
  `prefab` field: loading the save rebuilds them without the referenced scene.
- For a component built from a scene file by the same `ComponentDefinitions`:
  its file id and asset slots, and the `data` its definition's `capture`
  returns. A definition without `capture` keeps the data the component was
  built or last applied with.
- For any other component: the first definition, in registration order,
  that `owns` it and has a `capture`, with a new id and no asset slot.
  Components no definition owns are left out, so a runtime component that
  needs an asset does not come back.
- For a behavior: the `@SceneProperty` fields, written by
  [`ScriptDefinition`](../components/behavior.md#scene-files). Other fields
  are not saved.

A save captured in edit mode lacks the scripts, which edit mode never
builds.

## SceneInstance

Keeps the live actors and components of a scene file, by file id. `FileScene`
fills one in play mode. An editor keeps one in edit mode and applies each
document change to it.

```ts
interface SceneInstanceOptions<TContext> {
  world: World<any, TContext>;
  mode: "edit" | "play";
  components: ComponentDefinitions;
  assets: ComponentAssetResolver;
  prefabs?: ScenePrefabs;
  sceneId?: string;
}

interface SceneInstanceComponent {
  id: string;
  actorId: string;
  component: Component;
}

type SceneInstanceEvents = {
  componentBuilt: (built: SceneInstanceComponent) => void;
  componentDropped: (component: Component) => void;
};
```

`prefabs` finds the scenes [prefab instances](#prefab-instances) expand.
`sceneId` names the scene this instance builds, so an instance of it is
skipped at once.

`actor(id)` and `component(id)` return the built actor or component, or
`null`. An expanded actor or component goes by its path id. `actorId(object)` returns the file id of the actor whose `object3D` is
`object`, or `null`; it does not search ancestors. `components()` iterates
the built components.

### add(actors): void

Creates the actors in order, under the actor of their `parentId` or at the
root. The parent may come from the same call or an earlier one.

- An actor whose parent was not built is skipped with a warning, and so is
  its subtree. So is a duplicate id.
- An actor whose id belongs to a live actor of the world, such as a
  [persistent actor](../actor/actor.md#persistent-actors), is skipped
  without a warning, with its subtree: the live actor is kept.
- A component type without a definition is skipped, with a warning in play
  mode only. So is a `null` from `create`, without a warning.
- Transforms are written to `actor.object3D` directly.
- An actor with `prefab` gets its scene's actors built under it.

### refresh(sceneId): void

Destroys what every instance of `sceneId` expanded, nested instances
included, and expands them again from `prefabs`. Call it when that scene
changes.

### remove(id): void

Destroys the actor and its subtree, and forgets their ids and components.
Emits `componentDropped` for each component it forgets.

### reparent(id, parentId): void

Moves the actor under the actor of `parentId`, or to the root for `null`,
keeping its local transform.

### write(id, { name, visible, transform }): void

Writes the name, visibility and transform of an actor file to a built actor.

### rebuildComponent(actorId, entry): void

Destroys the component with the id of `entry`, if any, and creates it again
on the actor of `actorId`.

### removeComponent(id): void

Destroys the component and forgets it.

### applyComponent(id, type, data): boolean

Parses `data` with the definition of `type` and passes it to the definition's
`apply`. Returns `false`, changing nothing, when the component is not built or
the definition has no `apply`; rebuild the component in that case.

### clear(): void

Destroys every actor it built and forgets every id.

## Scene transforms

### writeSceneTransform(object, transform): void

Writes a `SceneTransformFile` (rotation in degrees) to a `THREE.Object3D`
and updates its world matrix.

### readSceneTransform(pose): SceneTransformFile

Reads a `{ position, quaternion, scale }` pose, such as a `THREE.Object3D` or
a decomposed matrix, into a `SceneTransformFile`, rotation in degrees. It is
the inverse of `writeSceneTransform`.

### composeSceneTransform(transform, target?): THREE.Matrix4

Composes the local matrix `writeSceneTransform` would give an object, into
`target` or a new matrix.

## SceneEnvironment

`new SceneEnvironment(world)` writes a `SceneEnvironmentFile` to the world's
`THREE.Scene`.

- `apply(file)` sets the background color, the fog and the environment
  intensity.
- The `room` environment is `BakedRoomEnvironment` from
  `@jolly-pixel/three`. It loads in the background; the map is set once it
  arrives and the world is invalidated. A failed load logs a warning.
- `dispose()` clears the background, fog and environment map.

## Built-in definitions

Each one parses a missing field to the component's own default
(`CAMERA_DEFAULTS`, `LIGHT_DEFAULTS`, `MESH_RENDERER_DEFAULTS`), and
captures the live component back to data.

- `CameraDefinition` (`Camera`): the [camera](../components/camera.md)
  options. In edit mode the camera is created with `render: false`.
- `LightDefinition` (`Light`): a [light](../components/light.md).
- `MeshDefinition` (`Mesh`): a [mesh renderer](../components/renderers.md#meshrenderer).
- `ScriptDefinition` (`Script`): a [behavior](../components/behavior.md#scene-files)
  found by name in the record it was given.
