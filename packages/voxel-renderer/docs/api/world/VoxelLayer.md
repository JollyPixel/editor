# VoxelLayer

A named, ordered collection of `VoxelChunk`s. Returned by `VoxelWorld.addLayer()`.

## VoxelLayerOptions

```ts
interface VoxelLayerConfigurableOptions {
  /** Defaults to "composite". */
  compositing?: "replace" | "composite";
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
   * World-space position of the layer origin.
   * @default { x: 0, y: 0, z: 0 }
   **/
  position?: VoxelCoord;
}
```

## Properties

```ts
class VoxelLayer {
  compositing: "replace" | "composite";
  id: string;
  name: string;
  order: number;
  visible: boolean;
  opacity: number;
  wasVisible: boolean;

  // number of currently allocated chunks
  readonly chunkCount: number;

  // world-space position of the layer origin
  position: VoxelCoord;
  properties: Record<string, any>;
}
```

These properties are mutable in the TypeScript API because deserialization and
world management update them. Application code should use the corresponding
`VoxelWorld` or `VoxelEngine` methods so mesh invalidation and hooks still run.

> **`position`** - locates the layer-local origin in world space. Always use
> `VoxelWorld.setLayerPosition` or `translateLayer` so chunks are marked dirty.

> **`opacity`** - `1` = fully opaque (default), `0` = hidden (same as `visible = false`). Values below `0` or above `1` are clamped. Faded layers (`0 < opacity < 1`) cull faces only within their own layer and remain solid for collision. Always use `VoxelWorld.setLayerOpacity` or `updateLayer` to apply changes.

`compositing` defaults to `"composite"`: at opacity `1`, only a block whose
opaque shape covers all six cell boundaries suppresses lower voxels in the
same cell. `"replace"` suppresses them for any occupying block at opacity `1`,
including masked and blended blocks. Faded layers preserve lower voxels in
both modes. Change this through `world.updateLayer(name, { compositing })` to
mark all layers dirty and emit the update. The setting survives cloning and
serialization.

Mask coverage is tested against texture alpha before the layer fade. Layers
continue fading below `alphaTest`; blend mode has no alpha cutoff.

## Methods

### `toJSON(): VoxelLayerJSON`

Returns the serializable layer state.

```ts
interface VoxelLayerJSON {
  id: string;
  name: string;
  visible: boolean;
  opacity?: number;
  order: number;
  position?: { x: number; y: number; z: number; };
  properties?: Record<string, any>;
  voxels: Record<VoxelEntryKey, VoxelEntryJSON>;
}
```

> [!NOTE]
> Used by `serializeVoxelWorld()`. See
> [serialization](../serialization/serialization.md).

### `getOrCreateChunk(cx: number, cy: number, cz: number): VoxelChunk`

Returns the `VoxelChunk` at the given chunk coordinates, creating it if it does not exist.

```ts
const chunk = layer.getOrCreateChunk(0, 0, 0);
```

### `getChunk(cx: number, cy: number, cz: number): VoxelChunk | undefined`

Returns the `VoxelChunk` at the given chunk coordinates, or `undefined` if none exists.

```ts
const chunk = layer.getChunk(1, 0, -2);
if (!chunk) {}
```

### `getVoxelAt(position: Vector3Like): VoxelEntry | undefined`

Read a voxel at world-space `position`.
Returns a freshly built `VoxelEntry`, or `undefined` if empty. See the
[storage note](./VoxelChunk.md#storage) on why the result is never `===` what was written.

```ts
const entry = layer.getVoxelAt({ x: 10, y: 5, z: 0 });
```

### `getPackedVoxelAt(position: Vector3Like): PackedVoxel`

Allocation-free `getVoxelAt`, returning `VOXEL_ABSENT` (`-1`) for air.

### `setVoxelAt(position: Vector3Like, entry: VoxelEntry): void`

Set a voxel at world-space `position`. Allocates a chunk if necessary and marks it dirty for rebuild.

```ts
layer.setVoxelAt({ x: 0, y: 0, z: 0 }, { blockId: 3, transform: 0 });
```

### `setPackedVoxelAt(position: Vector3Like, packed: PackedVoxel): void`

Allocation-free `setVoxelAt`, taking the value `packVoxel()` produces.

### `removeVoxelAt(position: Vector3Like): void`

Remove the voxel at the given world-space `position`. If the containing chunk becomes empty it is freed.

```ts
layer.removeVoxelAt({ x: 0, y: 0, z: 0 });
```

### `localToWorld(position: Vector3Like): Vector3`

Converts a layer-local coordinate to world space.

### `worldToLocal(position: Vector3Like): Vector3`

Converts a world-space coordinate to layer-local space.

### `localBounds(): Box3 | null`

Returns the voxel content bounds in layer-local space, or `null` when empty.
The maximum corner includes the full extent of the outermost unit voxels.

### `worldBounds(): Box3 | null`

Returns the voxel content bounds in world space, or `null` when empty.

### `worldCenter(): Vector3`

Returns the center of the world-space content bounds. An empty layer returns
its position.

### `rebase(position: Vector3Like): void`

Moves the layer origin to `position` and rewrites local storage so every voxel
remains at the same world-space coordinate. Prefer `VoxelWorld.rebaseLayer()`
when the layer belongs to a world.

### `markChunkDirty(cx: number, cy: number, cz: number): void`

Mark the chunk at the given chunk coordinates as dirty so it will be rebuilt.

```ts
layer.markChunkDirty(0, 0, 0);
```

### `getChunks(): IterableIterator<VoxelChunk>`

Iterate allocated chunks in this layer.

```ts
for (const chunk of layer.getChunks()) {
  // process chunk
}
```

### `clone(options?: Partial<VoxelLayerOptions>): VoxelLayer`

Creates a detached copy of the layer, including its voxels and properties. Use
`VoxelWorld.cloneLayer()` or `VoxelEngine.cloneLayer()` when the clone should be
added to a world.

The copy owns its own chunks, position and properties; editing it never reaches
the source. `options.chunkSize` is ignored, since the copied chunks are built
for the source's chunk size.

### `mergeFrom(source: VoxelLayer, options?: VoxelLayerMergeOptions): void`

Copies every voxel from `source` into this layer, resolved in world space so
layer positions are honoured. Prefer the world or engine merge method when the
operation must update world state or emit hooks.

`options.overwrite` defaults to `true`, letting source voxels replace target
voxels at the same world position. Pass `false` to fill only the positions this
layer leaves empty.

### `drainPendingRemovals(): IterableIterator<VoxelChunk>`

Consumes chunks that became empty and were removed from storage. Renderers use
this iterator to dispose stale meshes; ordinary callers rarely need it.
