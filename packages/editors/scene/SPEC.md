# Scene editor SPEC

A scene is an asset: a tree of actors, each with an ordered list of
components. The scene editor builds one; a game plays it through the engine.
This file records the decisions taken on 2026-10-25 and the build order. It is
deleted once built; the durable parts move into the ARCHITECTURE, GLOSSARY and
docs pages of the workspaces involved.

The [three.js editor](https://github.com/mrdoob/three.js/tree/master/editor)
is a reference for which fields exist (camera, lights, primitives, scene
background and fog) and for the project/scene split of renderer settings. Its
`ObjectLoader` format is not used.

## Scope of v1

In:

- the `scene` asset kind, its commands and collaborative editing;
- engine instantiation of a scene file, in edit and play mode;
- the component types `Camera`, `Light`, `Mesh`, `Script` and `VoxelMap`;
- `@jolly-pixel/editor.scene`: hierarchy, inspector, scene pane, viewport;
- a host asset picker dialog;
- a read-only voxel-map viewer extracted from the voxel-map editor;
- studio registration.

Out, each with its own later plan:

- **Play from studio.** Building a game, the static asset catalog export, and
  the game-side loaders for `voxelmap`, `blockset` and `pixelart`.
- **Prefabs.** The file reserves the slot (see [Prefabs](#prefabs)); the
  editor refuses it until prefab cut 1.
- **A script asset.** v1 scripts name a behavior the game registers.
- **More component types.** Voxel-model, GLB models, sprites, text.
- **Editor extras.** Play mode in the editor, a camera preview inset,
  copy/paste across scenes, snapping settings, tours.

## Scene file

`SceneFile` is the saved form, stored as `.scene.json`. Its TypeScript
interfaces live in the engine, which must not import an asset workspace;
`asset.scene` owns the zod schema and a tstyche test checks the schema against
the engine interfaces.

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
    // Euler angles in degrees, as voxel-model's BlockTransform
    rotation: Vector3JSON;
    scale: Vector3JSON;
  };
  components: SceneComponentFile[];
  // Reserved for prefabs; refused until prefab cut 1
  prefab?: AssetReferenceData;
}

interface SceneComponentFile {
  id: string;
  type: string;
  data: Record<string, JSONValue>;
  assets: Record<string, AssetReferenceData | null>;
}
```

- **Order.** `actors` lists every actor in tree order: an actor follows its
  parent, and siblings appear in their display order. `components` is ordered.
- **Ids.** Strings from `randomId()`, unique within one file. They never
  become `Actor.persistentId`, which stays a runtime id: prefab instances
  would repeat inner ids.
- **The envelope.** The server validates `id`, `type`, a size-bounded JSON
  `data` and the `assets` map, and nothing else. `dependencies()` is the
  union of every `assets` map plus every `prefab`. A component type the
  reader does not know round-trips untouched.
- **Compact form.** Like voxel-model, the stored file drops an identity
  transform and `visible: true`; the decoder fills them back in.

### Environment

```ts
interface SceneEnvironmentFile {
  background: ColorJSON | null;
  environment: { kind: "none" | "room"; intensity: number; };
  fog:
    | { kind: "none"; }
    | { kind: "linear"; color: ColorJSON; near: number; far: number; }
    | { kind: "exp2"; color: ColorJSON; density: number; };
}
```

Renderer settings (antialias, shadows and shadow type, tone mapping, exposure)
belong to the studio project file, read by the runtime and the editor. A
scene carries only background, environment and fog. Textured backgrounds and
equirect environments wait for texture slots. The environment of an included
scene is ignored; only the root scene's applies.

### New scene seed

A created scene holds three actors:

- "Main Camera": a perspective `Camera` at `(0, 2, 6)` looking at the origin;
- "Sun": a directional `Light` with shadows;
- "Sky": a hemisphere `Light`.

## Engine

New engine surface, in `src/systems/scene/` and `src/components/`:

- **`ComponentDefinition`.** One per component type:

  ```ts
  interface ComponentDefinition<TData, TComponent extends Component, TAssets> {
    readonly type: string;
    // Asset type per slot; filled slots load before the scene activates
    readonly assets?: { [TSlot in keyof TAssets]: AssetType<TAssets[TSlot]> };
    parse(data: JSONObject): TData;
    // null when the mode needs no component
    create(actor: Actor, data: TData, context: ComponentContext<TAssets>): TComponent | null;
    // Patches a live component; without it a data change rebuilds it
    apply?(component: TComponent, data: TData): void;
  }

  interface ComponentContext<TAssets> {
    readonly mode: "edit" | "play";
    readonly assets: ComponentAssets<TAssets>;
  }
  ```

  `ComponentAssetResolver` turns an `assets` slot into a value. In play mode
  it reads `world.assetCoordinator`; in edit mode the editor supplies one
  backed by host leases.
- **`ComponentDefinitions`.** The registry a game passes to `FileScene`. A
  game registers only the definitions it uses, which keeps tree-shaking.
- **`SceneBuilder`.** Builds the actors of a `SceneFile` under a parent actor
  (or the root), in edit or play mode. It returns a lookup from file id to
  `Actor` and to component. An unknown component type logs a warning and is
  skipped in play mode; prefab expansion lands here in cut 1.
- **`FileScene extends Scene`.** Takes a parsed `SceneFile`, declares the
  definitions' assets as `scene.assets`, and runs a `SceneBuilder` in
  `awake()`. It goes through `SceneManager.loadScene()` like any scene.
- **Environment.** `SceneBuilder` applies `environment` to the
  `THREE.Scene`; the room environment reuses `BakedRoomEnvironment` from
  `@jolly-pixel/three`.

### v1 component types

| Type | Lives in | Play mode | Edit mode |
|---|---|---|---|
| `Camera` | engine, existing `CameraComponent` | renders | frustum helper, never a render camera |
| `Light` | engine, new `LightComponent` | light | light plus a three.js helper as pick target |
| `Mesh` | engine, new `MeshRenderer` | mesh | mesh, pick target |
| `Script` | engine, `Behavior` | builds the behavior | inert |
| `VoxelMap` | voxel-renderer engine plugin, `VoxelRenderer` | needs the later loaders | read-only viewer, pick target |

- **`Camera` data.** The `CameraOptions` fields: projection mode, fov,
  near, far, orthographic scale, viewport, depth.
- **`Light` data.** `kind: ambient | hemisphere | directional | point | spot`,
  color (and ground color for hemisphere), intensity, distance, decay, angle,
  penumbra, `castShadow`, shadow map size and bias. Directional and spot
  lights aim along the actor's forward axis. Changing `kind` rebuilds the
  component. The project's shadow setting gates `castShadow`.
- **`Mesh` data.** `geometry: { kind, ...params }` for box, sphere, plane,
  cylinder, cone, torus and capsule, with the three.js constructor parameters;
  `material` holds `MeshStandardMaterial` fields: color, roughness,
  metalness, emissive, emissive intensity, opacity, flat shading. Texture
  maps come later through `assets`. `castShadow` and `receiveShadow`.
- **`Script` data.** `{ behavior: string; properties: Record<string, JSONValue> }`.
  The game registers behaviors by explicit name
  (`new ScriptDefinition({ Player: PlayerBehavior })`), since `Behavior` keys
  `actor.behaviors` by `constructor.name` and minified builds mangle it.
  Property values are converted through the class's `@SceneProperty`
  metadata, so `[0, 1, 0]` becomes a `Vector3`; keys without that metadata
  are ignored. A later script asset fills
  `assets.script` next to `behavior`.
- **`VoxelMap` data.** `castShadow`, `receiveShadow` and the layer
  visibility the renderer exposes. The map comes from `assets.map`.

Transforms never go through components: an actor's transform writes
`actor.object3D` directly.

## `@jolly-pixel/asset.scene`

Follows the asset workspace layout described in `packages/assets/ARCHITECTURE.md`:
`src/asset/scene.ts` (kind constants, descriptor, `createSceneFile`),
`src/asset/sceneAssetKind.ts` (`SceneState`, decoder, kind handler),
`src/network/` (commands, keys, `SceneDocument`, `sceneDocumentKind()`).

| Value | |
|---|---|
| Kind | `scene` |
| Extension | `.scene.json` |
| Label | Scene |
| Saved form | `SceneFile`, `compactSceneFileSchema` |
| Server state | `SceneState` |
| Live client state | `SceneDocument`, synced through `commandDocumentKind` |

### Commands and conflict keys

Last write wins through `KeyedCommandArbiter`, with tree rules checked first in
`state.accepts()`, as voxel-model does.

| Command | Conflict keys |
|---|---|
| `actor-added` (subtree, parent, index) | tree validation |
| `actor-removed` (subtree) | every key of the subtree, refused only with a `basis` |
| `actor-moved` (parent, index, transform rewritten to keep the world pose) | `parent:id`, `transform:id:field` |
| `actor-renamed` | `name:id` |
| `actor-visibility` | `visible:id` |
| `actor-transformed` (patch of position, rotation, scale) | `transform:id:field` |
| `component-added` (entry, index) | `components:actorId` |
| `component-removed` | `components:actorId`, the component's keys, refused only with a `basis` |
| `component-moved` (index) | `components:actorId` |
| `component-changed` (patch of top-level `data` fields) | `component:id:field` per field |
| `component-assets-changed` (slot to reference or `null`) | `component-asset:id:slot` |
| `environment-changed` (field patch) | `environment:field` |

`component-changed` merges top-level fields into `data`, so two people can edit
a light's color and intensity at once. A nested value such as a vector or a
color is replaced whole. The room never needs a component's schema.

`accepts()` refuses a `prefab` field until prefab cut 1, a parent cycle, and an
id that already exists.

History registration follows the other kinds through `@jolly-pixel/history`.

## Host

- **`session.pickAsset(options)`.** A dialog next to
  `session/dialogs/`:

  ```ts
  pickAsset(options: {
    kinds: string[];
    title: string;
    current?: AssetReferenceData | null;
  }): Promise<AssetReferenceData | null>;
  ```

  It lists `session.catalog.records()` filtered by kind as a folder tree, with
  search and kind icons, and follows catalog changes while open. `null` means
  cancelled. It works standalone and in the studio, where the catalog comes
  through the shell's catalog port.
- **Offline back-end.** The `scene` kind is registered with the offline
  server so the editor runs standalone.

## Voxel-map viewer

`@jolly-pixel/editor.voxel-map/viewer` is a subpath export, as
`editor.pixel-art/mesh-texturing` is. It takes `session.assets` and a map id,
leases the map, its blocksets and their pixel-art textures, and returns a
`VoxelDocument` plus a configured view whose atlases follow blockset and
texture edits. It has no write path.

It is extracted from the read side of `src/features/blocksets/`
(`MapBlocksets`, `BlocksetAtlasBridge`), and the voxel-map editor moves to it
so there is one atlas binding.

The `VoxelMap` definition lives in voxel-renderer's engine plugin and reads
its `VoxelDocument` through `ComponentContext.assets`. The scene editor's
resolver answers `assets.map` with the viewer.

## `@jolly-pixel/editor.scene`

An editor workspace with the `jollypixel.editor` manifest
(`kinds: ["scene"]`), booted through `mountStandalone` like the others.

- **`SceneBinding`.** Turns `SceneDocument` changes into incremental actor
  and component updates through `SceneBuilder` and the definitions' `apply`.
  It owns the edit-mode `ComponentAssetResolver`.
- **Hierarchy pane.** Arbor `TreeView`, modelled on voxel-model's
  `HierarchyPanel`: drag to reparent or reorder keeping the world pose,
  rename, delete, duplicate (Mod+D), multi-select. Its *Add* menu holds
  Empty, Camera, the five lights, the seven primitives and "Voxel map…",
  which opens the picker and creates an actor named after the asset.
- **Inspector pane.**
  - Actor fields: name, visible, position, rotation in degrees, scale.
  - Components list: add, remove, reorder, collapse. *Add component* lists
    the registered types; an asset-backed entry ("Voxel map…") opens the
    picker and is one `component-added` command, so one undo step.
  - One form per type from typed property rows the editor declares for the
    v1 types.
  - An asset slot row shows the asset name with *Change…*, *Clear* and
    *Open in editor*. The last asks the shell to open that asset's tab, or
    switches target when standalone.
  - `Script`: a behavior name field and free typed rows (number, string,
    boolean, Vector2/3/4, color) the user adds.
  - An unknown type shows its JSON, read-only.
- **Scene pane.** The `environment` block.
- **Viewport.** `EditorRuntime` with the orbit-fly camera. Click to pick,
  selection synced with the tree; `TransformControls` from
  `@jolly-pixel/three` (W/E/R, local/world toggle); F frames the selection;
  camera and light helpers.
- **History and keys.** Undo and redo through `@jolly-pixel/history`, with
  rebindable keys in the editor's preferences scope.
- **Presence.** Peer selection in the tree and peer frustums
  (`PeerFrustums`).

## Prefabs

Any scene can be included in another; there is no separate prefab kind.

- **v1.** The `prefab` field exists in the file and is refused by the room
  and the editor.
- **Cut 1.** An actor with `prefab` holds no children of its own. Its name,
  visibility and transform form the instance root, and `SceneBuilder` expands
  the referenced scene's root actors under it, in edit and play mode alike.
  Instances are read-only; cycles are refused in the editor and in
  `accepts()`.
- **Cut 2.** Overrides addressed by `instanceActorId/innerActorId/componentId`
  paths, and "apply to prefab".

`SceneManager.appendScene()` does not fit: an appended scene adds root actors
with its own lifecycle, while an instance is parented under an actor.

## Tests

- **Engine.** `SceneBuilder` (tree order, unknown types, edit versus play
  mode), `FileScene` assets and activation, `Script` property conversion,
  the `Light` and `Mesh` definitions with and without `apply`.
- **`asset.scene`.** Decoder and compact form, `SceneState.accepts()` tree
  rules, conflict keys per command, `dependencies()`, the tstyche check of
  the schema against the engine interfaces.
- **Host.** `pickAsset` filtering and catalog following, under `happy-dom`.
- **Editor.** `SceneBinding` against a `SceneDocument`, inspector forms under
  `happy-dom`.
- **One Playwright smoke test** for the editor: picking and the gizmo need a
  real canvas.

## Plan

Each phase ends with its workspace tests, `pnpm run typecheck` and
`pnpm run lint` green, after `pnpm run build` of the changed workspaces.

1. **Engine.** `SceneFile` interfaces, `ComponentDefinition`,
   `ComponentDefinitions`, `SceneBuilder`, `FileScene`, `LightComponent`,
   `MeshRenderer`, and the `Camera`, `Light`, `Mesh` and `Script`
   definitions. Engine docs for the new API.
2. **`asset.scene`.** Schema, `SceneState`, commands, keys, arbiter, kind
   handler, `SceneDocument`, history registration.
3. **Voxel-map viewer.** Extract `editor.voxel-map/viewer`, move the voxel-map
   editor onto it, add the `VoxelMap` definition behind the resolver.
4. **Host.** `session.pickAsset()` and the offline `scene` kind.
5. **`editor.scene`.** Boot, `SceneBinding`, hierarchy, inspector, scene pane,
   viewport and gizmo, history, presence, preferences.
6. **Studio.** Add the editor and the kind to `project.json`, and the
   Playwright smoke test.
