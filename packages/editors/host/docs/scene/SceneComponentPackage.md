# SceneComponentPackage

The contract a package implements to add component types to the scene editor.
The `scene` entry holds types, the `FormRows` builder, the
`SharedSceneViewers` resolver, the [contribution](#contributions) helpers,
`SCENE_COMPONENT_CATEGORIES` and
[`registerKindIcon`](../shell/Shell.md#other-helpers).

```ts
import {
  FormRows,
  SharedSceneViewers,
  type SceneComponentPackage
} from "@jolly-pixel/editor.host/scene";
```

A package exports its `SceneComponentPackage` as `SCENE_COMPONENTS` from an
export subpath, and names that subpath in its manifest. `sceneComponents`
declares each component type with the asset kind of each `definition.assets`
slot, so Node clients such as golem can check a component without loading
the module:

```json
{
  "jollypixel": {
    "scene": "./scene",
    "sceneComponents": {
      "VoxelMap": {
        "assets": {
          "map": "voxelmap"
        }
      }
    }
  },
  "exports": {
    "./scene": "./src/sceneComponents/index.ts"
  }
}
```

The scene editor loads the package when the project file lists it under
`editors` or `kinds`. The studio refuses a `scene` contribution without
`sceneComponents`, and a component type that two packages declare.

Nothing compares the declaration with the module at runtime, so the package
pins it with a spec. `assertDeclaresSceneComponents(packageDir, components)`
from `@jolly-pixel/editor.host/testing` reads `packageDir/package.json` and
fails unless its `sceneComponents` is the object the `SceneComponentPackage`
implies, with `assets` left out of a component that has no slot:

```ts
import { assertDeclaresSceneComponents } from "@jolly-pixel/editor.host/testing";

test("matches the scene components the package declares", () => {
  assertDeclaresSceneComponents(kPackageDir, SCENE_COMPONENTS);
});
```

```ts
const kRows = new FormRows<VoxelMapSettings>();

export const SCENE_COMPONENTS: SceneComponentPackage = {
  components: [
    {
      definition: new VoxelMapDefinition(),
      label: "Voxel map",
      category: "3d",
      form: () => [
        kRows.boolean(["castShadow"], "Cast shadow")
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
  assets?: readonly SceneAssetSource[];
}
```

The editor refuses to boot when two packages declare the same component type
or the same asset kind.

## Contributions

```ts
interface SceneContribution {
  readonly name: string;
  readonly module: {
    readonly SCENE_COMPONENTS?: SceneComponentPackage;
  };
}

type NamedSceneComponentPackage = readonly [
  name: string,
  components: SceneComponentPackage
];

type AssetSlots = Readonly<Record<string, AssetType<unknown>>>;

function contributedScenePackages(
  contributions: Iterable<SceneContribution>
): NamedSceneComponentPackage[];
function requiredAssetSlots(kind: SceneComponentKind): AssetSlots;
```

`SceneContribution` is one entry of the
`virtual:jolly-pixel/contributions/scene` module: a package that declares
`jollypixel.scene` and the module its subpath exports.

- `contributedScenePackages()` pairs each package name with its
  `SCENE_COMPONENTS`. It throws a `TypeError` naming the package when a module
  does not export it.
- `requiredAssetSlots()` returns the `definition.assets` slots that are not
  listed in `optionalAssets`.

## SceneComponentKind

```ts
interface SceneComponentKind<TData extends object = any, TAssets = any> {
  definition: Systems.ComponentDefinition<TData, any, TAssets>;
  label: string;
  category: SceneComponentCategory;
  initialData?: Systems.JSONObject;
  icon?: string;
  form: ComponentForm<TData, TAssets>;
  optionalAssets?: readonly (keyof TAssets & string)[];
  describe?: ComponentDescriber<TData, TAssets>;
  anchorAsset?: string;
  origin?: "center" | "corner";
}

type ComponentForm<TData, TAssets> = (
  data: TData,
  assets: Systems.ComponentAssets<TAssets>
) => FormRow<TData>[];

type ComponentDescriber<TData, TAssets> = (
  data: TData,
  assets: SceneComponentAssetNames<TAssets>
) => SceneComponentSummary;

type SceneComponentAssetNames<TAssets> = {
  readonly [TSlot in keyof TAssets]?: string;
};

interface SceneComponentSummary {
  label: string;
  detail?: string;
}

type SceneComponentCategory =
  "camera" | "light" | "3d" | "2d" | "physics" | "audio" | "logic" | "ui";
```

`definition` is the engine definition a game registers too. Import it from
the package's `jollypixel.runtime` entry (`RuntimeComponentPackage` in
`@jolly-pixel/runtime`), so the editor and the game share one object. Its
`assets` slots decide which asset pickers open when the component is added.

The component shows the asset kind icon of its first `definition.assets` slot
whose kind an `assets` source declares with an icon, so a voxel map component
looks like a voxel map asset. Otherwise it shows `icon`, the name of an icon
the package registers with `registerIcon` from `@jolly-pixel/ui` when its
module loads.

`category` picks the folder of the Add component menu, which lists the
categories in the order of `SCENE_COMPONENT_CATEGORIES` (`{ id, label }`).
A category without kinds is hidden, and a category holding one kind shows that
kind in place of the folder. A kind whose `definition.assets` slots pick an
asset ends with an ellipsis.

`optionalAssets` lists slots the scene editor leaves empty when it adds the
component; the inspector still offers them. An optional slot names no icon,
adds no ellipsis to the menu entry, and is hidden while no `assets` source
opens its kind. Picking or clearing one also clears the component's slots
that `definition.assets` does not declare, such as the texture slots a shader
adds to the form. The built-in `Mesh` declares its `shader` slot this way.

`initialData` is the data a component starts with when the scene editor adds
it, for example `{ castShadow: true }`. It defaults to `{}`.

`form` receives the data parsed by `definition.parse()` and the component
assets, and returns the inspector rows. `assets.resolve(slot)` returns the
value the slot's asset source resolved, or `null` while it loads; the
inspector renders again once it has loaded.

- An edit of a top-level field patches that field; setting it back to its
  default unsets it.
- An edit of a nested field rewrites the whole object.
- An edit inside a `list` row rewrites the whole list.

`describe` names one component in the hierarchy row and the inspector title.
It receives the data parsed by `definition.parse()` and the catalog name of
each `definition.assets` slot that holds an asset. `detail` shows muted after
the label in the hierarchy. A camera returns `{ label: "Orthographic camera" }`;
a script returns its asset name as the label. Without `describe`, the summary
is `label`, with the name of the first slot that holds an asset as `detail`.

When several components of one actor share a label and detail, the hierarchy
appends `#1`, `#2`, and so on to their detail. Rows rebuild when the catalog
changes, so a renamed asset renames its components.

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
  vector(path: FieldPath<TData>, label: string, bounds?: NumberBounds): VectorRow<TData>;
  asset(slot: string, label: string, type: AssetType<unknown>): AssetRow;
  list(key: ListKey<TData>, label: string, list: ListItems<Item>): ListRow;
}

interface ListItems<TItem> {
  itemLabel: string;
  seed: Systems.JSONObject;
  rows(item: TItem): readonly FieldRow<TItem>[];
}
```

- A `FieldPath` is one key of `TData`, or a key and one key of the nested
  object.
- Rows are plain objects, so a form can also write a `text` or `properties`
  row directly.
- A `choice` row with `resets: true` replaces its parent object instead of
  merging into it. Its value also picks the defaults that the other rows of
  that object show.
- A `vector` row edits an `{ x, y, z }` object, or `{ x, y }` and
  `{ x, y, z, w }` with `size: 2` or `size: 4`.
- Any field row takes an optional `fallback`, the value shown and used as the
  default while the data has none.
- An `asset` row is an asset picker for the component's `assets` map under
  `slot`, which the definition need not declare. It writes the reference, not
  the data.
- A `list` row edits an array field of objects. `rows` returns the rows of
  one parsed item; their paths start at the item. Each item shows as a folder
  titled `itemLabel` and its number,
  with a remove button, and the add button appends `seed`. The parsed items
  must keep the stored layout, because an edit writes them back.
- A `properties` row edits a JSON object of named values. Its optional
  `declared` list (`key`, `type`, `label`, `description`, `default`) shows
  those properties first with a fixed key and type; a declared property
  without a stored value shows its default.

### shaderUniformRows(shader): FormRow[]

Returns one row per uniform the shader declares, for data with a `uniforms`
object: a `number`, `color` or `vector` row at `["uniforms", name]` with the
declared default as `fallback`, or an `asset` row for the texture slot
`shaderTextureSlot(name)`. It returns `[]` for `null`, so a form can call it
with `assets.resolve("shader")` while the shader loads.

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
  ready?(reference: AssetReferenceData): Promise<void>;
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
- `ready()` settles once the value for that reference is complete: its leases
  are ready and its images decoded. It rejects when the asset fails to load.
  The studio's asset preview waits on it before it reads the pixels back, and
  renders no preview for a kind whose resolver lacks it.

## SharedSceneViewers

```ts
class SharedSceneViewers<TViewer extends SharedSceneViewer, TSource>
  implements SceneAssetResolver<TSource> {
  constructor(options: SharedSceneViewersOptions<TViewer, TSource>);
}

interface SharedSceneViewer {
  readonly ready: Promise<void>;
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
- `ready()` returns the viewer's `ready`, opening the viewer when no component
  holds it yet. A viewer opened that way stays open until `dispose()`.
