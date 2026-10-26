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
  prefab?: AssetReferenceData; // reserved, ignored by the builder
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
- Ids are unique within one file. They are file ids, not
  `Actor.persistentId`.
- The engine reads the decoded form. A file with an identity transform or
  `visible: true` left out must be decoded before it reaches the engine.

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
`ComponentAssetResolver` to `SceneBuilder`.

### ComponentDefinitions

- `register(...definitions): this` throws when a type is already registered.
- `find(type): ComponentDefinition | null`
- `assets(file)` yields the asset references of every known component in the
  file.

## FileScene

```ts
class FileScene<TContext> extends Scene<TContext> {
  readonly file: SceneFile;
  readonly build: SceneBuild<TContext> | null; // null until awake

  constructor(
    name: string,
    file: SceneFile,
    options: { components: ComponentDefinitions; }
  );
}
```

- Its `assets` are the definitions' assets, loaded by
  [`SceneManager`](scene-manager.md) like any scene.
- `awake()` builds the actors in play mode and applies the environment.
- `destroy()` resets the background, fog and environment map.

## SceneBuilder

```ts
interface SceneBuilderOptions<TContext> {
  world: World<any, TContext>;
  mode: "edit" | "play";
  components: ComponentDefinitions;
  assets: ComponentAssetResolver;
}
```

### build(actors, parent?): SceneBuild

Creates the actors under `parent`, or at the root, and returns a lookup from
file id to `Actor` (`build.actor(id)`) and to component
(`build.component(id)`).

- An actor whose parent was not built is skipped with a warning, and so is
  its subtree. So is a duplicate id.
- A component type without a definition is skipped, with a warning in play
  mode only. So is a `null` from `create`, without a warning.
- Transforms are written to `actor.object3D` directly.

### createComponent(actor, entry): Component | null

Creates one component of `entry` on an existing actor, as `build` does for
each entry. Returns `null` for an unknown type or a `null` from `create`. An
editor uses it to rebuild a single component after an edit.

### writeSceneTransform(object, transform): void

Writes a `SceneTransformFile` (rotation in degrees) to a `THREE.Object3D`
and updates its world matrix.

### readSceneTransform(object): SceneTransformFile

Reads the local position, rotation and scale of a `THREE.Object3D` back
into a `SceneTransformFile`, rotation in degrees. It is the inverse of
`writeSceneTransform`.

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
(`CAMERA_DEFAULTS`, `LIGHT_DEFAULTS`, `MESH_RENDERER_DEFAULTS`).

- `CameraDefinition` (`Camera`): the [camera](../components/camera.md)
  options. In edit mode the camera is created with `render: false`.
- `LightDefinition` (`Light`): a [light](../components/light.md).
- `MeshDefinition` (`Mesh`): a [mesh renderer](../components/renderers.md#meshrenderer).
- `ScriptDefinition` (`Script`): a [behavior](../components/behavior.md#scene-files)
  found by name in the record it was given.
