# VoxelLayer

A named voxel layer with its own position in the world. Get one from
`world.addLayer()` or `world.getLayer()` on a [`VoxelWorld`](./VoxelWorld.md).

> [!IMPORTANT]
> Writes made on a layer (`setVoxelAt`, `setPackedVoxelAt`, `removeVoxelAt`,
> `rebase`, `mergeFrom`) are raw: they emit no command and reach no
> [recorder](./VoxelWorld.md#recorders), so no undo history sees them. Edit through
> [`VoxelWorld`](./VoxelWorld.md) for synced and undoable changes. The same
> applies to assigning the properties below: use `world.updateLayer()`,
> `world.setLayerPosition()` and the other world methods.

```ts
const layer = document.world.getLayer("Ground");

layer.getVoxelAt({ x: 10, y: 5, z: 0 });
layer.worldBounds();
```

## Options

`VoxelLayerConfigurableOptions` is what `world.addLayer()` and
`world.updateLayer()` accept.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `compositing` | `"composite" \| "replace"` | `"composite"` | How the layer covers lower layers in the same cell. |
| `visible` | `boolean` | `true` | Saved visibility. |
| `properties` | `Record<string, any>` | `{}` | Free-form layer data. |

`"composite"` lets only a block whose opaque shape fills the whole cell hide
lower voxels in that cell. `"replace"` hides them under any block, masked and
blended ones included. See
[layer compositing](../../concepts/world-model.md#layer-compositing).

## Properties

| Property | Type | Description |
| --- | --- | --- |
| `id` | `string` | Unique id, used by commands. |
| `name` | `string` | Unique name, used by the world methods. |
| `order` | `number` | Position in the stack; higher draws on top. |
| `rank` | `string` | Stack position carried by layer commands. |
| `position` | `VoxelCoord` | World position of the layer origin. |
| `visible` | `boolean` | Saved visibility. |
| `compositing` | `"composite" \| "replace"` | See [options](#options). |
| `properties` | `Record<string, any>` | Free-form layer data. |
| `chunkSize` | `number` | Read-only. |
| `voxelCount` | `number` | Read-only. Stored voxels. |
| `revision` | `number` | Read-only. Grows on every voxel write, removal, load or rebase. |

A layer has no `toJSON()`; use
[`serializeVoxelLayer(layer)`](../serialization/serialization.md).

## Reading

#### `getVoxelAt(position: Vector3Like): VoxelEntry | undefined`

The voxel at a world position, or `undefined` for air. Each call returns a new
object, so compare entries by value. A
[merged cell](./VoxelWorld.md#merged-cells) carries its second shape in
`partner`.

#### `getPackedVoxelAt(position: Vector3Like): PackedVoxel`

#### `getPartnerVoxelAt(position: Vector3Like): PackedVoxel`

Same lookup without allocating, for the first and the second shape. Return
`VOXEL_ABSENT` for air, and `getPartnerVoxelAt()` also for a cell that is not
merged; see [packed voxels](./VoxelChunk.md#packed-voxels).

#### `positionsOf(blockIds: ReadonlySet<number>): IterableIterator<VoxelCoord>`

World positions of the voxels whose block is in `blockIds`, whatever their
transform. A merged cell matches when either shape does.

#### `countBlocks(): Map<number, number>`

Voxel count per block id, counting both shapes of a merged cell. Returns a
new map.

#### `countBlock(blockId: number): number`

Voxels of `blockId` in the layer; `0` when none.

## Bounds and coordinates

#### `localBounds(): Box3 | null`

#### `worldBounds(): Box3 | null`

Voxel content bounds in layer-local or world space, or `null` for an empty
layer. The maximum corner includes the full extent of the outermost voxels.

#### `worldCenter(): Vector3`

Center of `worldBounds()`. An empty layer returns its position.

#### `localToWorld(position: Vector3Like): Vector3`

#### `worldToLocal(position: Vector3Like): Vector3`

## Raw writes

#### `setVoxelAt(position: Vector3Like, entry: VoxelEntry): void`

#### `setPackedVoxelAt(position: Vector3Like, packed: PackedVoxel, partner?: PackedVoxel): void`

Write a cell at a world position, replacing both shapes of a merged cell.
`entry.partner` or `partner` makes it a merged cell. `VOXEL_ABSENT` removes
the cell.

#### `removeVoxelAt(position: Vector3Like): void`

Removes the cell, both shapes included.

#### `localVoxels(): IterableIterator<[x: number, y: number, z: number, packed: PackedVoxel, partner: PackedVoxel]>`

Every cell in layer-local space. `partner` is `VOXEL_ABSENT` for a cell that
is not merged.

#### `rebase(position: Vector3Like): void`

Moves the layer origin to `position` and keeps every voxel at the same world
position. `world.rebaseLayer()` is the world equivalent.

#### `mergeFrom(source: VoxelLayer, options?: { overwrite?: boolean }): void`

Copies every voxel of `source` into this layer at the same world positions.
`overwrite` defaults to `true`; `false` only fills cells this layer leaves
empty.

#### `clone(options?: Partial<VoxelLayerOptions>): VoxelLayer`

A detached copy with the same voxels, position and properties. `options`
override the copied values, except `chunkSize`, which is ignored. To add a copy
to a world, use `world.cloneLayer()`.
