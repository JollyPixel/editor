# World

Data model for the voxel world: layers, chunks, and per-voxel entries.

---

## Types

```ts
/** World-space integer position. Any `THREE.Vector3Like` is accepted wherever `VoxelCoord` is expected. */
interface VoxelCoord {
  x: number;
  y: number;
  z: number;
}

interface VoxelEntry {
  blockId: number;   // references BlockDefinition.id; 0 = air (never stored)
  transform: number; // packed rotation + flip flags — write via VoxelRenderer.setVoxel
}
```

---

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

Removes all layers.

---

## VoxelLayer

A named, ordered collection of `VoxelChunk`s. Returned by `VoxelWorld.addLayer()`.

### VoxelLayerOptions

```ts
interface VoxelLayerOptions {
  id: string;
  name: string;
  order: number;
  chunkSize: number;
  visible?: boolean;  // default: true
  offset?: VoxelCoord; // default: {x:0, y:0, z:0}
}
```

### Properties

```ts
readonly id: string;          // auto-assigned unique identifier, stable across the session
readonly name: string;
readonly order: number;       // compositing priority — higher values win
readonly visible: boolean;
offset: VoxelCoord;           // world-space translation applied to every voxel in the layer
readonly chunkCount: number;  // number of currently allocated chunks
```

> **Offset semantics** — `offset` shifts where voxels appear in world space without
> changing the underlying chunk storage. A voxel set at local position `{0,0,0}` renders
> at `{offset.x, offset.y, offset.z}`. Use `VoxelWorld.setLayerOffset` or
> `translateLayer` (preferred) so all dependent chunks are marked dirty automatically.

---

## VoxelChunk

Fixed-size, sparse 3D grid of `VoxelEntry` data. Chunk coordinates `(cx, cy, cz)` are in
**chunk space** — multiply by `chunkSize` to get the world-space origin.

### Constructor

```ts
new VoxelChunk([cx, cy, cz]: [number, number, number], size?: number)
```

### Properties

```ts
readonly cx: number;
readonly cy: number;
readonly cz: number;
readonly size: number;    // side length in voxels
dirty: boolean;           // set true on any write; cleared by VoxelRenderer after mesh rebuild
readonly voxelCount: number;
```

### Methods

#### `get(lx: number, ly: number, lz: number): VoxelEntry | undefined`

#### `set(lx: number, ly: number, lz: number, entry: VoxelEntry): void`

#### `delete(lx: number, ly: number, lz: number): void`

#### `isEmpty(): boolean`

#### `entries(): IterableIterator<[number, VoxelEntry]>`

Iterates all stored entries as `[linearIndex, VoxelEntry]` pairs.

#### `linearIndex(lx: number, ly: number, lz: number): number`

Converts local chunk coordinates to the flat map key used for sparse storage.

#### `fromLinearIndex(idx: number): [number, number, number]`

Inverse of `linearIndex`.

---

## Constants

```ts
const DEFAULT_CHUNK_SIZE = 16;
```
