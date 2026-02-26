# World

Data model for the voxel world: layers, chunks, and per-voxel entries.

Under the hood world use:
- [Chunk](./Chunk.md)
- [Layer](./Layer.md)

## Types

```ts
/**
 * World-space integer position.
 * Any `THREE.Vector3Like` is accepted wherever `VoxelCoord` is expected.
 **/
interface VoxelCoord {
  x: number;
  y: number;
  z: number;
}

interface VoxelEntry {
  // references BlockDefinition.id;
  // 0 = air (never stored)
  blockId: number;
  // packed rotation + flip flags
  transform: number;
}
```

## VoxelWorld

Top-level container for a layered voxel scene. Layers are composited from highest `order`
to lowest — the first visible layer that has a voxel at a given position wins.
This allows decorative layers to override base terrain non-destructively.

### Constructor

```ts
new VoxelWorld(chunkSize?: number) // default: 16
```

### Properties

```ts
readonly chunkSize: number;
```

### Methods

#### `addLayer(name: string): VoxelLayer`

Creates and appends a new layer with the next available `order`.

#### `removeLayer(name: string): boolean`

Removes a layer by name. Returns `false` if not found.

#### `moveLayer(name: string, direction: "up" | "down"): void`

Swaps `order` with the neighbouring layer in the given direction.

#### `setLayerVisible(name: string, visible: boolean): void`

Hidden layers are skipped during compositing and mesh rebuild.

#### `setLayerOffset(name: string, offset: VoxelCoord): void`

Sets the world-space translation of a layer. All voxels in that layer are shifted by
`offset` — a voxel stored at local `{0,0,0}` will appear at `{offset.x, offset.y, offset.z}`
in world space. Marks all chunks in every layer dirty so cross-layer face culling is
re-evaluated on the next frame. No-op if the layer is not found.

#### `translateLayer(name: string, delta: VoxelCoord): void`

Adds `delta` to the layer's current offset. Equivalent to calling `setLayerOffset` with
`layer.offset + delta`. Marks all chunks dirty. No-op if the layer is not found.

#### `getLayer(name: string): VoxelLayer | undefined`

#### `getLayers(): readonly VoxelLayer[]`

All layers, sorted highest `order` first.

#### `getVoxelAt(position: VoxelCoord): VoxelEntry | undefined`

Composited read — returns the voxel from the highest-priority visible layer at that position.
Returns `undefined` for air.

#### `getVoxelNeighbour(position: VoxelCoord, face: Face): VoxelEntry | undefined`

Composited read of the voxel immediately adjacent to `position` in the given face direction.

#### `setVoxelAt(layerName: string, position: VoxelCoord, entry: VoxelEntry): void`

Writes a voxel directly and marks neighbouring chunks dirty for boundary face re-evaluation.
Throws if the layer is not found. Prefer `VoxelRenderer.setVoxel` to handle rotation packing.

#### `removeVoxelAt(layerName: string, position: VoxelCoord): void`

Removes a voxel. No-op if the layer is not found.

#### `getAllChunks(): Generator<[VoxelLayer, VoxelChunk]>`

Iterates over every chunk across all layers.

#### `getAllDirtyChunks(): Generator<[VoxelLayer, VoxelChunk]>`

Iterates over chunks whose `dirty` flag is set.

#### `clear(): void`

Removes all voxel layers and object layers.

### Object Layer Management

Object layers hold placed objects (spawn points, trigger zones, etc.) rather than
voxel data. They are stored by name and serialised as part of `VoxelWorldJSON`.

#### `addObjectLayer(name: string, options?: { visible?: boolean; order?: number }): VoxelObjectLayerJSON`

Creates a new object layer. `order` defaults to the current layer count (appended last).
Returns the new layer descriptor.

#### `removeObjectLayer(name: string): boolean`

Deletes an object layer by name. Returns `false` if not found.

#### `getObjectLayer(name: string): VoxelObjectLayerJSON | undefined`

Returns the layer descriptor for `name`, or `undefined` if it does not exist.

#### `getObjectLayers(): readonly VoxelObjectLayerJSON[]`

Returns a snapshot array of all object layers in insertion order.

#### `updateObjectLayer(name: string, patch: { visible?: boolean }): boolean`

Applies a partial patch to a named object layer. Returns `false` if not found.

#### `addObjectToLayer(layerName: string, object: VoxelObjectJSON): boolean`

Appends an object to the named layer's `objects` array. Returns `false` if the layer
does not exist.

#### `removeObjectFromLayer(layerName: string, objectId: string): boolean`

Removes the object with the given `id` from the layer. Returns `false` if the layer or
object is not found.

#### `updateObjectInLayer(layerName: string, objectId: string, patch: Partial<VoxelObjectJSON>): boolean`

Merges `patch` into the matching object. Returns `false` if the layer or object is not
found.

