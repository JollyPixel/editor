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
  wasVisible: boolean;

  // number of currently allocated chunks
  readonly chunkCount: number;

  // world-space translation applied to every voxel in the layer
  offset: VoxelCoord;
  properties: Record<string, any>;
}
```

> **Offset semantics** — `offset` shifts where voxels appear in world space without
> changing the underlying chunk storage. A voxel set at local position `{0,0,0}` renders
> at `{offset.x, offset.y, offset.z}`. Use `VoxelWorld.setLayerOffset` or
> `translateLayer` (preferred) so all dependent chunks are marked dirty automatically.


## Methods

### toJSON(): VoxelLayerJSON

Layer as a serializable JSON

```ts
interface VoxelLayerJSON {
  id: string;
  name: string;
  visible: boolean;
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
Returns the `VoxelEntry` or `undefined` if empty.

```ts
const entry = layer.getVoxelAt({ x: 10, y: 5, z: 0 });
```

### setVoxelAt(position: Vector3Like, entry: VoxelEntry): void

Set a voxel at world-space `position`. Allocates a chunk if necessary and marks it dirty for rebuild.

```ts
layer.setVoxelAt({ x: 0, y: 0, z: 0 }, { blockId: 3, transform: 0 });
```

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
