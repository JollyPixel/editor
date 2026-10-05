# Voxel templates

A template is a named group of voxels saved with the world and never drawn.
Placing it copies its voxels into a layer; later edits to the template leave
placed voxels alone. Templates live in `world.templates` and are saved in
`VoxelWorldJSON.templates` (see [serialization](../serialization/serialization.md)).

```ts
const house = world.templates.createFromLayer("Draft", { name: "House" });

world.templates.place(house.id, {
  layerName: "Ground",
  position: { x: 40, y: 0, z: 12 },
  transform: { rotation: 1 }
});
```

## VoxelTemplates

Every method below emits a
[template command](../core/commands.md#template-commands) on the world's
`"command"` event, except `place()`, which emits one `"voxels-patched"` layer
command and records one [history](../core/VoxelHistory.md) step.

#### `size: number`, `get(id: string)`, `toArray(): VoxelTemplate[]`

The collection is also iterable.

#### `createFromLayer(layerName: string, options: VoxelTemplateCaptureOptions): VoxelTemplate | undefined`

Copies the voxels of a layer into a new template. The layer is not modified.
Returns `undefined` when the layer does not exist or no voxel is captured. An
`id` already in use replaces that template.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `name` | `string` | | Required. |
| `id` | `string` | unused `template_<n>` | Template id. |
| `bounds` | `{ min: Vector3Like; max: Vector3Like }` | whole layer | World cells in `[min, max)`. A `THREE.Box3` works. |
| `pivot` | `VoxelCoord` | bottom center | World cell that lands on the placement position. |
| `properties` | `Record<string, any>` | `{}` | Free-form data. |

#### `define(template: VoxelTemplateJSON): boolean`

Adds a template from its JSON form, such as one saved by
`serializeVoxelTemplate()` in another world, or replaces the one with the same
id. Throws `InvalidVoxelWorldError` for malformed JSON.

#### `update(id: string, patch: VoxelTemplatePatch): boolean`

Changes `name`, `pivot` (template-local) or `properties`. Voxels cannot be
patched; define the template again to change them.

#### `transform(id: string, transform: VoxelTransformOptions): boolean`

Turns and mirrors the stored voxels around the pivot. Returns `false` for the
identity transform.

#### `remove(id: string): boolean`

`update()`, `transform()` and `remove()` return `false` and emit nothing for an
unknown id.

#### `place(id: string, options: VoxelTemplatePlaceOptions): boolean`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `layerName` | `string` | | An existing layer. |
| `position` | `VoxelCoord` | | World cell the pivot lands on. |
| `transform` | `VoxelTransformOptions` | identity | Turns and mirrors the voxels around the pivot. |
| `overwrite` | `boolean` | `true` | `false` keeps voxels already in the layer. |

Returns `false` and writes nothing when the template or layer does not exist or
no cell would change. To place into a new layer, add it first with
`world.addLayer()`.

#### `countBlocks(): Map<number, number>`

Voxel count per block id across every template. A
[tileset slot](../tilesets/TilesetLink.md) stays reserved while a template
uses one of its block ids.

## VoxelTemplate

An immutable template. Its voxel positions start at `0, 0, 0`.

| Property | Type | Description |
| --- | --- | --- |
| `id`, `name` | `string` | Identity. |
| `pivot` | `VoxelCoord` | Template-local. Defaults to `floor(size.x / 2), 0, floor(size.z / 2)`. |
| `size` | `VoxelCoord` | Voxel extent per axis; `0, 0, 0` when empty. |
| `voxelCount` | `number` | Stored voxels. |
| `properties` | `Record<string, any>` | Free-form data. |

#### `localVoxels(): IterableIterator<VoxelTemplateVoxel>`

Template-local cells as `[x, y, z, packed, partner]`; `partner` is
`VOXEL_ABSENT` unless the cell is [merged](./VoxelWorld.md#merged-cells).

#### `placedVoxels(position: Vector3Like, transform?: VoxelTransform): IterableIterator<VoxelTemplateVoxel>`

World cells and voxels once the pivot sits on `position`. Voxel orientations,
second shapes included, turn with the placement.

#### `placedBounds(position: Vector3Like, transform?: VoxelTransform): VoxelTemplateBounds`

The `{ min, size }` box `placedVoxels()` fills.

#### `placedPositionFor(min: Vector3Like, transform?: VoxelTransform): VoxelCoord`

The placement position whose placed box starts at `min`.

#### `transformed(transform: VoxelTransform): VoxelTemplate`

#### `withPatch(patch: VoxelTemplatePatch): VoxelTemplate`

Copies with turned voxels, or with another `name`, `pivot` or `properties`.

#### `countBlocks(): Map<number, number>`

#### `VoxelTemplate.fromLayer(layer: VoxelLayer, options): VoxelTemplate`

Builds a template that belongs to no world, for example to preview a layer.
`options` are the `createFromLayer()` options with a required `id`.
