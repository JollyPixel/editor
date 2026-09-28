# Voxel templates

A voxel template is a named group of voxels saved with the world. It is never
drawn. Placing a template copies its voxels into a layer, so later edits to the
template do not change voxels already placed.

Templates live in `world.templates`, a `VoxelTemplates` keyed by id, and are
saved in [`VoxelWorldJSON.templates`](../serialization/serialization.md#templates).

```ts
const house = world.templates.createFromLayer("Draft", { name: "House" });

world.templates.place(house.id, {
  layerName: "Ground",
  position: { x: 40, y: 0, z: 12 },
  transform: { rotation: 1 }
});
```

## `VoxelTemplate`

```ts
class VoxelTemplate {
  readonly id: string;
  readonly name: string;
  readonly pivot: Readonly<VoxelCoord>;
  readonly properties: Readonly<Record<string, any>>;
  readonly size: Readonly<VoxelCoord>;
  readonly voxelCount: number;

  constructor(options: VoxelTemplateOptions);

  localVoxels(): IterableIterator<VoxelTemplateVoxel>;
  placedVoxels(
    position: Vector3Like,
    transform?: VoxelTransform
  ): IterableIterator<VoxelTemplateVoxel>;
  transformed(transform: VoxelTransform): VoxelTemplate;
  countBlocks(): Map<number, number>;
  withPatch(patch: VoxelTemplatePatch): VoxelTemplate;
}

interface VoxelTemplateOptions {
  id: string;
  name: string;
  pivot?: VoxelCoord;
  properties?: Record<string, any>;
  positions: ArrayLike<number>; // x, y, z per voxel
  voxels: ArrayLike<PackedVoxel>;
}

type VoxelTemplateVoxel = [x: number, y: number, z: number, packed: PackedVoxel];
```

A template is immutable. The constructor copies `positions`, `voxels` and
`properties`, then shifts the positions so the lowest corner of the voxels is
`0, 0, 0`. `pivot` is given in the same space as `positions` and shifted with
them. Without a pivot, the template pivots on its bottom center:
`floor(size.x / 2), 0, floor(size.z / 2)`. `size` is the voxel extent on each
axis, `0, 0, 0` for an empty template. The constructor throws a `RangeError`
when `positions` does not hold three numbers per voxel.

`localVoxels()` yields template-local cells with their packed voxel.
`placedVoxels()` yields world cells once the pivot sits on `position`:
`transform` turns and mirrors each cell offset around the pivot with
[`transformOffset()`](./VoxelTransform.md#methods), and each voxel's own
transform becomes `voxelTransform.followedBy(transform)`, so turned blocks keep
facing the right way.

`transformed()` returns a copy whose voxels are the placed voxels turned
around the pivot, shifted back so the lowest corner is `0, 0, 0`. The pivot
cell moves with them.

`withPatch()` returns a copy with another `name`, `pivot` or `properties`.

## `VoxelTemplates`

```ts
class VoxelTemplates implements Iterable<VoxelTemplate> {
  readonly size: number;
  toArray(): VoxelTemplate[];
  get(id: string): VoxelTemplate | undefined;
  createFromLayer(
    layerName: string,
    options: VoxelTemplateCaptureOptions
  ): VoxelTemplate | undefined;
  define(template: VoxelTemplateJSON): boolean;
  update(id: string, patch: VoxelTemplatePatch): boolean;
  transform(id: string, transform: VoxelTransformOptions): boolean;
  remove(id: string): boolean;
  place(id: string, options: VoxelTemplatePlaceOptions): boolean;
  countBlocks(): Map<number, number>;
  apply(command: VoxelTemplateCommand): VoxelTemplateCommand | null;
  restore(templates: Iterable<VoxelTemplate>): void;
  clear(): void;
}

interface VoxelTemplatePatch {
  name?: string;
  pivot?: VoxelCoord;
  properties?: Record<string, any>;
}
```

Every change emits a [template command](../core/commands.md#template-commands)
on the world's `"command"` event, except `apply()`, `restore()` and `clear()`.
Placement emits a `"voxels-patched"` layer command instead.

### `createFromLayer(layerName, options)`

```ts
interface VoxelTemplateCaptureOptions {
  name: string;
  id?: string; // default: an unused "template_<n>"
  bounds?: { min: Vector3Like; max: Vector3Like; };
  pivot?: VoxelCoord;
  properties?: Record<string, any>;
}
```

Copies the voxels of a layer into a new template and emits
`"template-defined"`. `bounds` and `pivot` are in world space, so the layer
position applies: a voxel is kept when its cell lies in `[min, max)` on every
axis, and `pivot` is the world cell that will land on the placement position.
A `THREE.Box3` works as `bounds`. The layer is not modified.

Returns `undefined` and emits nothing when the layer does not exist or no voxel
is captured. An `id` already in use replaces that template.

### `define(template)`

Adds a template from its JSON form, or replaces the one with the same id, and
emits `"template-defined"`. Use it to import a template saved by
[`serializeVoxelTemplate()`](../serialization/serialization.md#templates) from
another world. Throws `InvalidVoxelWorldError` when `template` is malformed.

### `update(id, patch)` and `remove(id)`

Emit `"template-updated"` and `"template-removed"`. Both return `false` and emit
nothing when the template does not exist. A patched `pivot` is
template-local. Voxels are never updated in place:
define the template again to change them.

### `transform(id, transform)`

Turns and mirrors the stored voxels around the pivot with
[`transformed()`](#voxeltemplate) and emits `"template-defined"` with the
result. `transform` takes `VoxelTransformOptions`. Returns `false` and emits
nothing for the identity transform or an unknown template.

### `place(id, options)`

```ts
interface VoxelTemplatePlaceOptions {
  layerName: string;
  position: VoxelCoord;
  transform?: VoxelTransformOptions; // default: identity
  overwrite?: boolean; // default: true
}
```

Writes the [placed voxels](#voxeltemplate) into an existing layer through
[`world.patchVoxels()`](./VoxelWorld.md#patchvoxelslayername-string-cells-readonly-number-void),
so the placement is one `"voxels-patched"` command and one
[history](../core/VoxelHistory.md) step. `position` is a world cell. With
`overwrite: false`, cells already holding a voxel in that layer keep it.

Returns `false` and writes nothing when the template or layer does not exist,
or when no cell would be written. To place into a new layer, add it first:

```ts
world.addLayer("House 1");
world.templates.place(house.id, { layerName: "House 1", position });
```

### `countBlocks()`

Voxel count per block id across every template. A tileset slot stays reserved
while a template still uses one of its block ids, so a tileset added later
cannot take it over.
