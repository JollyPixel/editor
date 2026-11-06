# SceneComponentPackage

The contract a package implements to add component types to the scene editor.
The `scene` entry holds types, the `FormRows` builder, the
`SharedSceneViewers` resolver, `SCENE_ACTOR_CATEGORIES` and
[`registerKindIcon`](../shell/Shell.md#other-helpers).

```ts
import {
  FormRows,
  SharedSceneViewers,
  type SceneComponentPackage
} from "@jolly-pixel/editor.host/scene";
```

A package exports its `SceneComponentPackage` as `SCENE_COMPONENTS` from an
export subpath, and names that subpath in its manifest:

```json
{
  "jollypixel": {
    "scene": "./scene"
  },
  "exports": {
    "./scene": "./src/sceneComponents/index.ts"
  }
}
```

The scene editor loads the package when the project file lists it under
`editors` or `kinds`.

```ts
const kRows = new FormRows<VoxelMapSettings>();

export const SCENE_COMPONENTS: SceneComponentPackage = {
  components: [
    {
      definition: new VoxelMapDefinition(),
      label: "Voxel map",
      form: () => [
        kRows.boolean(["castShadow"], "Cast shadow")
      ]
    }
  ],
  presets: [
    {
      category: "3d",
      presets: [
        {
          id: "voxel-map",
          label: "Voxel map",
          components: [{ type: "VoxelMap", data: {} }]
        }
      ]
    }
  ],
  assets: [
    {
      descriptor: VOXEL_MAP_ASSET,
      documentKinds: VoxelMapViewer.kinds,
      open: (session) => new SharedSceneViewers({
        open: (mapId) => new VoxelMapViewer({
          assets: session.assets,
          catalog: session.catalog,
          mapId
        }),
        source: (viewer, hold): VoxelMapSource => ({
          document: viewer.document,
          attach: (view) => hold(viewer.attach(view))
        })
      })
    }
  ]
};
```

## SceneComponentPackage

```ts
interface SceneComponentPackage {
  components: readonly SceneComponentKind[];
  presets?: readonly SceneActorPresetSection[];
  assets?: readonly SceneAssetSource[];
}
```

The editor refuses to boot when two packages declare the same component type,
the same asset kind or the same preset `id`. The preset id `"empty"` belongs
to the scene editor.

## SceneComponentKind

```ts
interface SceneComponentKind<TData extends object = any, TAssets = any> {
  definition: Systems.ComponentDefinition<TData, any, TAssets>;
  label: string;
  icon?: string;
  form: ComponentForm<TData, TAssets>;
  anchorAsset?: string;
  origin?: "center" | "corner";
}

type ComponentForm<TData, TAssets> = (
  data: TData,
  assets: Systems.ComponentAssets<TAssets>
) => FormRow<TData>[];
```

`definition` is the engine definition a game registers too. Its `assets`
slots decide which asset pickers open when the component is added.

The component shows the asset kind icon of its first `definition.assets` slot
whose kind an `assets` source declares with an icon, so a voxel map actor
looks like a voxel map asset. Otherwise it shows `icon`, the name of an icon
the package registers with `registerIcon` from `@jolly-pixel/ui` when its
module loads.

`form` receives the data parsed by `definition.parse()` and the component
assets, and returns the inspector rows. `assets.resolve(slot)` returns the
value the slot's asset source resolved, or `null` while it loads; the
inspector renders again once it has loaded.

- An edit of a top-level field patches that field; setting it back to its
  default unsets it.
- An edit of a nested field rewrites the whole object.

`anchorAsset` names the `definition.assets` slot whose asset the anchor keys
from `definition.anchors()` belong to. An anchor row then offers to show the
anchor in that asset, which opens it with the anchor key as its
[reveal](../shell/Shell.md#reveals). Without it, the row has no such entry.

`origin` says where the actor origin sits on the rendered content. Set
`"corner"` when the content grows from the origin toward the positive axes,
as voxel map blocks do. Grid snapping in the scene editor then keeps the origin
on grid lines instead of cell centers. It defaults to `"center"`.

## FormRows

```ts
class FormRows<TData> {
  number(path: FieldPath<TData>, label: string, bounds?: NumberBounds): NumberRow<TData>;
  boolean(path: FieldPath<TData>, label: string): BooleanRow<TData>;
  color(path: FieldPath<TData>, label: string): ColorRow<TData>;
  choice(path: FieldPath<TData>, label: string, options: readonly ChoiceOption[]): ChoiceRow<TData>;
}
```

- A `FieldPath` is one key of `TData`, or a key and one key of the nested
  object.
- Rows are plain objects, so a form can also write a `text` or `properties`
  row directly.
- A `choice` row with `resets: true` replaces its parent object instead of
  merging into it.
- A `properties` row edits a JSON object of named values. Its optional
  `declared` list (`key`, `type`, `label`, `description`, `default`) shows
  those properties first with a fixed key and type; a declared property
  without a stored value shows its default.

## Presets

```ts
interface SceneActorPreset {
  id: string;
  label: string;
  components: readonly SceneComponentSeed[];
}

interface SceneActorPresetSection {
  category: SceneActorCategory;
  presets: readonly SceneActorPreset[];
}

type SceneActorCategory =
  "camera" | "light" | "3d" | "2d" | "audio" | "logic" | "ui";

interface SceneComponentSeed {
  type: string;
  data: Systems.JSONObject;
}
```

- The hierarchy's Add menu starts with Empty, then shows one folder per
  category, in the order of `SCENE_ACTOR_CATEGORIES` (`{ id, label }`).
  A category without presets is hidden, and a category holding one preset
  shows that preset in place of the folder.
- Inside a folder, each section with several presets is a block, in package
  order, and the one-preset sections share a last block. Separators split the
  blocks. The folder shows the icon of its first preset.
- A preset whose components pick an asset ends with an ellipsis, and the new
  actor is named after the first asset picked.

## SceneAssetSource

```ts
interface SceneAssetSource<TValue = unknown> {
  descriptor: AssetKindDescriptor;
  documentKinds: readonly AssetDocumentKind<unknown>[];
  open(
    session: SceneAssetContext,
    updates: SceneAssetUpdates
  ): SceneAssetResolver<TValue>;
}

type SceneAssetContext = Pick<EditorSession, "assets" | "catalog">;

interface SceneAssetUpdates {
  loaded(): void;
}

interface SceneAssetResolver<TValue = unknown> {
  resolve(reference: AssetReferenceData): TValue | null;
  dispose(): void;
}
```

Answers the asset slots of `descriptor.kind` while the scene is edited. The
asset picker offers that descriptor. `documentKinds` are added to the editor's
lease kinds.

The editor calls `open()` the first time a component resolves an asset of
that kind, and `dispose()` when it closes. The resolver owns the leases it
opens.

- `resolve()` returns `null` while an asset loads, such as a font read once
  from its room snapshot. The definition then builds its component without
  the asset.
- `updates.loaded()` tells the editor an asset arrived; the editor
  rebuilds the scene, and `resolve()` must then return the value.

## SharedSceneViewers

```ts
class SharedSceneViewers<TViewer extends SharedSceneViewer, TSource>
  implements SceneAssetResolver<TSource> {
  constructor(options: SharedSceneViewersOptions<TViewer, TSource>);
}

interface SharedSceneViewer {
  release(): void;
}

interface SharedSceneViewersOptions<TViewer, TSource> {
  open(assetId: string): TViewer;
  source(viewer: TViewer, hold: SceneViewerHold): TSource;
}

type SceneViewerHold = (detach: () => void) => () => void;
```

A `SceneAssetResolver` that keeps one viewer per asset id, however many
components show that asset.

- `open()` builds the viewer the first time an asset id resolves.
- `source()` builds the value a component receives. Pass each detach function
  the viewer returns through `hold`; the viewer stays open until every held
  detach has run.
- The viewer is released one microtask after its last held detach, so a
  component rebuilt in the same task keeps it. `dispose()` releases every open
  viewer.
