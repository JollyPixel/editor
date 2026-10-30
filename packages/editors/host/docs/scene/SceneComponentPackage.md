# SceneComponentPackage

The contract a package implements to add component types to the scene editor.
The `scene` entry holds types and the `FormRows` builder only.

```ts
import {
  FormRows,
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
      icon: "actor-voxel-map",
      form: () => [
        kRows.boolean(["castShadow"], "Cast shadow")
      ]
    }
  ],
  presets: [
    {
      id: "voxel-map",
      label: "Voxel map",
      components: [{ type: "VoxelMap", data: {} }]
    }
  ],
  assets: [
    {
      descriptor: VOXEL_MAP_ASSET,
      documentKinds: VoxelMapViewer.kinds,
      open: (session) => new SharedVoxelMaps(
        (mapId) => new VoxelMapViewer({
          assets: session.assets,
          catalog: session.catalog,
          mapId
        })
      )
    }
  ]
};
```

## SceneComponentPackage

```ts
interface SceneComponentPackage {
  components: readonly SceneComponentKind[];
  presets?: readonly SceneActorPresetEntry[];
  assets?: readonly SceneAssetSource[];
}
```

The editor refuses to boot when two packages declare the same component type,
the same asset kind or the same preset `id`.

## SceneComponentKind

```ts
interface SceneComponentKind<TData extends object = any> {
  definition: Systems.ComponentDefinition<TData, any, any>;
  label: string;
  icon: string;
  form: ComponentForm<TData>;
  anchorAsset?: string;
}

type ComponentForm<TData> = (data: TData) => FormRow<TData>[];
```

`definition` is the engine definition a game registers too. Its `assets`
slots decide which asset pickers open when the component is added.

`icon` names an icon registered with `registerIcon` from `@jolly-pixel/ui`.
The package registers it when its module loads.

`form` receives the data parsed by `definition.parse()` and returns the
inspector rows.

- An edit of a top-level field patches that field; setting it back to its
  default unsets it.
- An edit of a nested field rewrites the whole object.

`anchorAsset` names the `definition.assets` slot whose asset the anchor keys
from `definition.anchors()` belong to. An anchor row then offers to show the
anchor in that asset, which opens it with the anchor key as its
[reveal](../shell/Shell.md#reveals). Without it, the row has no such entry.

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

## Presets

```ts
interface SceneActorPreset {
  id: string;
  label: string;
  components: readonly SceneComponentSeed[];
}

interface SceneActorPresetGroup {
  label: string;
  presets: readonly SceneActorPreset[];
}

interface SceneComponentSeed {
  type: string;
  data: Systems.JSONObject;
}
```

- The presets of one package form one section of the hierarchy's Add menu;
  a group is a submenu.
- A preset whose components pick an asset ends with an ellipsis, and the new
  actor is named after the first asset picked.

## SceneAssetSource

```ts
interface SceneAssetSource<TValue = unknown> {
  descriptor: AssetKindDescriptor;
  documentKinds: readonly AssetDocumentKind<unknown>[];
  open(session: SceneAssetContext): SceneAssetResolver<TValue>;
}

type SceneAssetContext = Pick<EditorSession, "assets" | "catalog">;

interface SceneAssetResolver<TValue = unknown> {
  resolve(reference: AssetReferenceData): TValue;
  dispose(): void;
}
```

Answers the asset slots of `descriptor.kind` while the scene is edited. The
asset picker offers that descriptor. `documentKinds` are added to the editor's
lease kinds.

The editor calls `open()` the first time a component resolves an asset of
that kind, and `dispose()` when it closes. The resolver owns the leases it
opens.
