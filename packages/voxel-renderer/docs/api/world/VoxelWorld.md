# VoxelWorld

`VoxelWorld` owns voxel layers, object layers, and chunk lifecycle. Read
[the world model](../../concepts/world-model.md) for the ownership and compositing
rules.

## Values and coordinates

The world API uses these value types for positions and voxel contents:

```ts
interface VoxelCoord {
  x: number;
  y: number;
  z: number;
}

interface VoxelEntry {
  blockId: number;
  transform: number;
}
```

Any `THREE.Vector3Like` is accepted where a method expects `VoxelCoord`.
`VoxelEntry.blockId` refers to `BlockDefinition.id`; `0` means air and is never
stored. The maximum block ID is 8,388,607.

`VoxelEntry` is a value type. Chunks store packed integers and build a new object
for each unpacked read, so compare entries by value instead of identity. The
packed API on [`VoxelChunk`](./VoxelChunk.md#packed-voxel-values) avoids that
allocation on hot paths.

### `voxelCellOf(point)`

```ts
function voxelCellOf(point: VoxelCoord): VoxelCoord;
```

Returns the whole cell containing `point`. Cells use half-open spans and the
function floors each component. `{ x: 3.5, y: 0.5, z: 4.5 }` resolves to
`{ x: 3, y: 0, z: 4 }`; `{ x: -0.2, y: 0, z: 0 }` resolves to x = -1.

### `voxelPositionOf(point, normal, side?)`

```ts
function voxelPositionOf(
  point: VoxelCoord,
  normal: VoxelCoord,
  side?: "front" | "back"
): VoxelCoord;
```

Returns the cell on one side of a surface, for example after a raycast hit.
`"front"` is the empty cell the surface faces and is the default. `"back"` is
the cell that owns the surface. Neither argument is modified.

`"back"` nudges the point a fraction of a cell against the normal, so it holds
for slanted faces whose hit point sits inside the cell rather than on its
boundary, such as a ramp slope. `"front"` steps one cell from there along the
axis the normal leans on the most, ties resolving to Y; a hit anywhere on a
ramp slope therefore resolves to the ramp cell and places above it.

## `VoxelWorld`

Top-level container for a layered voxel scene. World reads examine layers from
highest `order` to lowest. The first visible layer with `opacity > 0` that has a
voxel at a given position wins. A layer with `opacity === 0` is skipped exactly
like an invisible one. Render-time compositing applies separate rules for
partially opaque layers, described in the
[world model](../../concepts/world-model.md#layer-compositing).

### Constructor

```ts
new VoxelWorld(chunkSize?: number) // default: 16
```

`chunkSize` must be a power of two. Every world-to-chunk conversion (on the
write path, in the mesher, and in neighbour lookups) is a shift and a mask.
Other sizes throw a `RangeError`.

### Properties

```ts
readonly chunkSize: number;
onLayerUpdated?: VoxelLayerHookListener;
```

Every mutating method below emits a [hook event](../core/hooks.md) on
`onLayerUpdated`, so an editor or a network adapter can mirror local edits
without wrapping the world. The exceptions are the `*At` write primitives
(`setVoxelAt`, `setPackedVoxelAt`, `removeVoxelAt`), `setLayerVisible`,
`setLayerOpacity`, `mergeAllLayers` and `clear`, which stay silent.

### Methods

#### `addLayer(name: string, options?: VoxelLayerConfigurableOptions): VoxelLayer`

Creates and appends a new layer with the next available `order`.

#### `updateLayer(name: string, options: Partial<VoxelLayerConfigurableOptions>): boolean`

Updates visibility, opacity, or properties. Returns `false` when the layer does
not exist.

#### `removeLayer(name: string): boolean`

Removes a layer by name. Marks all chunks in every layer dirty so faces culled against
the removed layer are re-evaluated. Returns `false` if not found.

#### `moveLayer(name: string, direction: "up" | "down"): void`

Moves the layer one step in the given direction. `"up"` raises the layer's
compositing priority, `"down"` lowers it. Does nothing when the layer is
already at that end of the stack.

#### `moveLayerTo(name: string, toIndex: number): void`

Moves the layer to an absolute position in `getLayers()` order, where index 0
is the highest compositing priority. `toIndex` is truncated and clamped to the
stack, so an out-of-range index lands the layer at the nearest end. A move that
leaves the layer where it already sits does nothing and emits nothing.

Both methods re-rank every layer's `order` densely and descending from the
resulting sequence, so `order` is an internal rank rather than a stable
identifier.

#### `setLayerVisible(name: string, visible: boolean): void`

Hidden layers are skipped during compositing and mesh rebuild. Marks all chunks in
every layer dirty when visibility actually flips, since cross-layer face culling
changes with it; otherwise only the layer's own chunks.

#### `setLayerOpacity(name: string, opacity: number): void`

Sets a layer's rendered translucency (clamped to `[0, 1]`). A layer with `opacity < 1`
is occluded only by its own voxels (like glass): nothing in another layer culls its
faces, and it hides neither neighbouring faces nor the voxels it covers; `opacity === 0`
is treated exactly like `visible = false`. Marks only the layer's own chunks dirty for a
same-bucket change (e.g. `0.4 → 0.6`), or every layer's chunks when the change crosses the
`opacity === 1` occlusion boundary. No-op if the layer is not found.

#### `setLayerOffset(name: string, offset: VoxelCoord): void`

Sets the world-space translation of a layer. All voxels in that layer are shifted by
`offset`: a voxel stored at local `{0,0,0}` will appear at `{offset.x, offset.y, offset.z}`
in world space. Marks all chunks in every layer dirty so cross-layer face culling is
re-evaluated on the next frame. No-op if the layer is not found.

#### `translateLayer(name: string, delta: VoxelCoord): void`

Adds `delta` to the layer's current offset. Equivalent to calling `setLayerOffset` with
`layer.offset + delta`. Marks all chunks dirty. No-op if the layer is not found.

#### `getLayer(name: string): VoxelLayer | undefined`

#### `getLayers(): readonly VoxelLayer[]`

All layers, sorted highest `order` first.

#### `cloneLayer(name: string, options?: Partial<VoxelLayerOptions>): VoxelLayer | undefined`

Clones a layer, voxels included, and inserts the copy directly above the source,
renumbering the whole stack. Other layer options can override the source values.
Returns `undefined` when the source layer does not exist.

`options.name` is optional; when omitted the world derives an unused name from
the source (`"layer"` becomes `"layer (1)"`, then `"layer (2)"`). A name that is
already taken is de-duplicated the same way, so layer names stay unique. The
emitted `"cloned"` hook carries the resolved name, so a peer replaying the
command produces the same layer rather than deriving a name of its own.

#### `uniqueLayerName(base: string): string`

The first layer name not already in use, derived from `base` by appending
`" (n)"`. Returns `base` unchanged when it is free.

#### `mergeLayer(sourceName: string, targetName: string): boolean`

Merges the source layer into the target and removes the source from the world.
Returns `false` when either layer does not exist, or when both names resolve to
the same layer.

Overlapping voxels are resolved by stack position: the layer with the higher
`order` wins, whichever of the two is the source. A merge therefore never
changes what an opaque stack looks like, in either direction. Opacity is not
modelled, so a translucent layer that visually blends is treated as opaque here.

The target keeps its own `opacity`, `visible` and offset. The source's
`properties` are folded in behind the target's, so keys already present on the
target win and the rest carry over.

#### `mergeAllLayers(): VoxelLayer | null`

Collapses all voxel layers into the lowest-order layer. Higher-order voxels win at
overlapping world positions, and every other voxel layer is removed. Returns `null`
for an empty world.

#### `getVoxelAt(position: THREE.Vector3Like): VoxelEntry | undefined`

Composited read. Returns the voxel from the highest-priority visible layer (`opacity > 0`)
at that position. Returns `undefined` for air.

#### `getPackedVoxelAt(position: THREE.Vector3Like): PackedVoxel`

Allocation-free `getVoxelAt`, returning `VOXEL_ABSENT` (`-1`) for air.

#### `getVoxelWithLayerAt(position: THREE.Vector3Like): { entry: VoxelEntry; layer: VoxelLayer } | undefined`

Same compositing rules as `getVoxelAt`, but also returns the owning `VoxelLayer` so callers
can inspect layer-level properties (e.g. `opacity`) of the resolved voxel.

#### `getVoxelNeighbour(position: THREE.Vector3Like, face: Face): VoxelEntry | undefined`

Composited read of the voxel immediately adjacent to `position` in the given face direction.

#### `setVoxel(layerName: string, options: VoxelSetOptions): void`

Places a voxel at a world-space position, packing rotation and flips for you,
and emits `"voxel-set"`.

```ts
interface VoxelSetOptions extends VoxelTransformOptions {
  position: THREE.Vector3Like;
  blockId: number;
  /** Y-axis rotation in 90° steps. Default: `VoxelRotation.None`. */
  rotation?: VoxelRotation;
  /** Mirror the block on the X axis. Default: `false`. */
  flipX?: boolean;
  /** Mirror the block on the Z axis. Default: `false`. */
  flipZ?: boolean;
  /** Mirror the block geometry around y = 0.5 (upside-down). */
  flipY?: boolean;
}
```

The rotation and flip fields come from
[`VoxelTransformOptions`](./VoxelTransform.md), which packs them into the
transform byte a chunk stores. A rotation outside `0..3` wraps rather than
spilling into the flip bits.

#### `removeVoxel(layerName: string, options: VoxelRemoveOptions): void`

Removes the voxel at a world-space position and emits `"voxel-removed"`.

```ts
interface VoxelRemoveOptions {
  position: THREE.Vector3Like;
}
```

#### `setVoxelBulk(layerName: string, entries: VoxelSetOptions[]): void`

Places several voxels and emits a single `"voxels-set"` for the batch.

```ts
world.setVoxelBulk("Ground", [
  { position: { x: 0, y: 0, z: 0 }, blockId: 1 },
  { position: { x: 1, y: 0, z: 0 }, blockId: 2, rotation: VoxelRotation.CW90 }
]);
```

#### `removeVoxelBulk(layerName: string, entries: VoxelRemoveOptions[]): void`

Removes several voxels and emits a single `"voxels-removed"` for the batch.

#### `setVoxelAt(layerName: string, position: THREE.Vector3Like, entry: VoxelEntry): void`

#### `setPackedVoxelAt(layerName: string, position: THREE.Vector3Like, packed: PackedVoxel): void`

Writes a voxel directly and marks neighbouring chunks dirty for boundary face re-evaluation.
Throws if the layer is not found. Emits nothing: prefer `setVoxel` unless you are
loading data peers already have.

#### `removeVoxelAt(layerName: string, position: THREE.Vector3Like): void`

Removes a voxel without emitting. No-op if the layer is not found.

#### `getAllChunks(): IterableIterator<IterableLayerChunk>`

Iterates over every chunk across all layers.

#### `getAllDirtyChunks(): IterableIterator<IterableLayerChunk>`

Iterates over chunks whose `dirty` flag is set.

```ts
interface IterableLayerChunk {
  layer: VoxelLayer;
  chunk: VoxelChunk;
}
```

#### `getAllChunksToBeRemoved(): IterableIterator<IterableLayerChunk>`

Consumes chunks whose meshes must be removed because their layer disappeared or
the chunk became empty. This is renderer-facing lifecycle plumbing.

#### `clear(): void`

Removes all voxel layers and object layers.

### Hooks

#### `applyRemoteCommand(cmd: VoxelLayerHookEvent, logger?: VoxelLogger): void`

Replays a peer's hook event onto this world without emitting it again through
`onLayerUpdated`, so a network adapter cannot echo it back. Every action of the
event union is handled; an unknown one throws.

A voxel command naming a layer this world no longer has is dropped rather than
thrown, since a peer can still be painting a layer that was just merged or
removed here. The optional `logger` receives a warning for each dropped command;
without one the drop is silent. Local writes through `setVoxel` and
`setPackedVoxelAt` still throw for an unknown layer, which stays a programming
error.

#### `silently<T>(fn: () => T): T`

Runs `fn` with `onLayerUpdated` muted and returns its result. Use it for
mutations peers already know about, such as deserializing a document.
`applyRemoteCommand` is built on it, and nesting is safe.

```ts
world.silently(() => deserializeVoxelWorld(snapshot, world));
```

### Object layer management

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

#### `moveObjectToLayer(fromLayerName: string, objectId: string, toLayerName: string): boolean`

Moves an object from one object layer to another, keeping the same object
instance, and emits a single `"object-moved"` hook. Returns `false` when either
layer or the object is not found, or when both names resolve to the same layer.

Prefer this over `removeObjectFromLayer` followed by `addObjectToLayer`: the
pair emits two independent commands, so two peers reparenting the same object at
once would each apply the other's add and leave the object duplicated in two
layers.

#### `updateObjectInLayer(layerName: string, objectId: string, patch: Partial<VoxelObjectJSON>): boolean`

Merges `patch` into the matching object. Returns `false` if the layer or object is not
found.
