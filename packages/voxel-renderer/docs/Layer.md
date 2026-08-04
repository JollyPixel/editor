# VoxelLayer

A named, ordered collection of `VoxelChunk`s. Returned by `VoxelWorld.addLayer()`.

## VoxelLayerOptions

```ts
interface VoxelLayerConfigurableOptions {
  /**
   * Whether the layer is visible by default.
   * @default true
   */
  visible?: boolean;
  /**
   * Rendered translucency, from `0` (fully transparent) to `1` (fully opaque).
   * Values are clamped to `[0, 1]`.
   * @default 1
   */
  opacity?: number;
  /**
   * Arbitrary layer properties.
   * @default {}
   */
  properties?: Record<string, any>;
}

interface VoxelLayerOptions extends VoxelLayerConfigurableOptions {
  /** Unique layer identifier. */
  id: string;
  /** Human-readable layer name. */
  name: string;
  /**
   * Draw order;
   * higher values render above lower ones.
   **/
  order: number;
  /** Size of one voxel chunk (required). */
  chunkSize: number;
  /**
   * World-space offset applied to voxels.
   * @default { x: 0, y: 0, z: 0 }
   **/
  offset?: VoxelCoord;
}
```

## Properties

```ts
class VoxelLayer {
  readonly id: string;
  readonly name: string;
  readonly order: number;
  readonly visible: boolean;
  readonly opacity: number;
  wasVisible: boolean;

  // number of currently allocated chunks
  readonly chunkCount: number;

  // world-space translation applied to every voxel in the layer
  offset: VoxelCoord;
  properties: Record<string, any>;
}
```

> **`offset`** - shifts where voxels render in world space; does not move chunk storage. Always use `VoxelWorld.setLayerOffset` or `translateLayer` so chunks are marked dirty.

> **`opacity`** - `1` = fully opaque (default), `0` = hidden (same as `visible = false`). Values below `0` or above `1` are clamped. Semi-transparent layers (`0 < opacity < 1`) skip face occlusion but are still solid for collision. Always use `VoxelWorld.setLayerOpacity` or `updateLayer` to apply changes.

> **`opacity` + `alphaTest`** - if `opacity` drops to or below `alphaTest` (default `0.1`) the layer disappears entirely instead of fading.

## Methods

### toJSON(): VoxelLayerJSON

Layer as a serializable JSON

```ts
interface VoxelLayerJSON {
  id: string;
  name: string;
  visible: boolean;
  opacity?: number;
  order: number;
  offset?: { x: number; y: number; z: number; };
  properties?: Record<string, any>;
  voxels: Record<VoxelEntryKey, VoxelEntryJSON>;
}
```

> [!NOTE]
> Used under the hood by the `VoxelSerializer` implementation, see: [Serialization](./Serialization.md)

### getOrCreateChunk(cx: number, cy: number, cz: number): VoxelChunk

Returns the `VoxelChunk` at the given chunk coordinates, creating it if it does not exist.

```ts
const chunk = layer.getOrCreateChunk(0, 0, 0);
```

### getChunk(cx: number, cy: number, cz: number): VoxelChunk | undefined

Returns the `VoxelChunk` at the given chunk coordinates, or `undefined` if none exists.

```ts
const chunk = layer.getChunk(1, 0, -2);
if (!chunk) {}
```

### getVoxelAt(position: Vector3Like): VoxelEntry | undefined

Read a voxel at world-space `position` (offset is applied).
Returns a freshly built `VoxelEntry`, or `undefined` if empty — see the
[storage note](./Chunk.md#storage) on why the result is never `===` what was written.

```ts
const entry = layer.getVoxelAt({ x: 10, y: 5, z: 0 });
```

### getPackedVoxelAt(position: Vector3Like): PackedVoxel

Allocation-free `getVoxelAt`, returning `VOXEL_ABSENT` (`-1`) for air.

### setVoxelAt(position: Vector3Like, entry: VoxelEntry): void

Set a voxel at world-space `position`. Allocates a chunk if necessary and marks it dirty for rebuild.

```ts
layer.setVoxelAt({ x: 0, y: 0, z: 0 }, { blockId: 3, transform: 0 });
```

### setPackedVoxelAt(position: Vector3Like, packed: PackedVoxel): void

Allocation-free `setVoxelAt`, taking the value `packVoxel()` produces.

### removeVoxelAt(position: Vector3Like): void

Remove the voxel at the given world-space `position`. If the containing chunk becomes empty it is freed.

```ts
layer.removeVoxelAt({ x: 0, y: 0, z: 0 });
```

### centerToWorld(): Vector3

Returns the world-space center of all voxels in the given layer, accounting for the layer offset.
When the layer has no voxels the layer offset itself is returned as a Vector3.

### markChunkDirty(cx: number, cy: number, cz: number): void

Mark the chunk at the given chunk coordinates as dirty so it will be rebuilt.

```ts
layer.markChunkDirty(0, 0, 0);
```

### getChunks(): IterableIterator< VoxelChunk >

Iterate allocated chunks in this layer.

```ts
for (const chunk of layer.getChunks()) {
  // process chunk
}
```
