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
recorder: VoxelEditRecorder | null;
```

`recorder` receives the cells changed by each non-silent `setVoxel`,
`removeVoxel`, `setVoxelBulk` and `removeVoxelBulk` call, read before the
write. [`VoxelHistory`](../core/VoxelHistory.md) installs itself there when
enabled.

```ts
interface VoxelEditRecorder {
  record(changes: VoxelCellChange[]): void;
}

interface VoxelCellChange {
  layerName: string;
  position: VoxelCoord;
  before: PackedVoxel; // VOXEL_ABSENT when the cell was empty
  after: PackedVoxel; // VOXEL_ABSENT when the cell was cleared
}
```

`VoxelWorld` extends `Emitter<VoxelWorldEvents>` from `@openally/emitt`:

```ts
type VoxelWorldEvents = {
  command: (command: VoxelLayerCommand) => void;
};
```

Every mutating method below emits a [layer command](../core/commands.md#layer-commands)
on `"command"`, so an editor or a network adapter can mirror local edits
without wrapping the world. `VoxelEngine` forwards these as local commands. The exceptions are the `*At` write primitives
(`setVoxelAt`, `setPackedVoxelAt`, `removeVoxelAt`), `setLayerVisible`,
`setLayerOpacity`, `mergeAllLayers` and `clear`, which stay silent.

### Methods

#### `addLayer(name: string, options?: VoxelLayerConfigurableOptions): VoxelLayer`

Creates a new layer on top of the stack, with the highest compositing priority.

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

Every change to the stack (adding, cloning, moving, removing or merging a
layer) re-ranks every layer's `order` densely and descending from the
resulting sequence, so `order` is an internal rank rather than a stable
identifier. Layer ids are unique within the world.

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

#### `setLayerPosition(name: string, position: VoxelCoord): void`

Sets the world-space translation of a layer. All voxels in that layer are shifted by
`position`: a voxel stored at local `{0,0,0}` will appear at `{position.x, position.y, position.z}`
in world space. Marks all chunks in every layer dirty so cross-layer face culling is
re-evaluated on the next frame. No-op if the layer is not found.

#### `translateLayer(name: string, delta: VoxelCoord): void`

Adds `delta` to the layer's current position. Equivalent to calling `setLayerPosition` with
`layer.position + delta`. Marks all chunks dirty. No-op if the layer is not found.

#### `rebaseLayer(name: string, position: VoxelCoord): void`

Moves the layer origin to `position` while preserving every voxel's world-space
location. Local chunk storage is rewritten and all layers are marked dirty.
No-op if the layer is not found.

#### `getLayer(name: string): VoxelLayer | undefined`

#### `getLayers(): readonly VoxelLayer[]`

All layers, sorted highest `order` first.

#### `cloneLayer(name: string, options?: Partial<VoxelLayerOptions>): VoxelLayer | undefined`

Clones a layer, voxels included, and inserts the copy directly above the source,
renumbering the whole stack and marking every layer's chunks dirty, since the
copy now covers the layers below it. Other layer options can override the
source values.
Returns `undefined` when the source layer does not exist.

`options.name` is optional; when omitted the world derives an unused name from
the source (`"layer"` becomes `"layer (1)"`, then `"layer (2)"`). A name that is
already taken is de-duplicated the same way, so layer names stay unique. The
emitted `"cloned"` command carries the resolved name, so a peer replaying the
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

The target keeps its own `opacity`, `visible` and position. The source's
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
Removing from a layer that does not exist changes nothing and emits nothing.

#### `transaction<T>(fn: () => T): T`

Runs `fn` and returns its result. Use it for large writes such as world
generation. Writes land immediately, but the voxel commands they emit are held
until `fn` returns:

- dirty chunks are marked once per touched chunk rather than once per voxel,
  in every layer;
- the changed cells go out as one `"voxels-patched"` per layer, where the
  last write to a cell wins and cells that end up unchanged are left out;
- the history records the whole transaction as a single undo step.

A nested `transaction` joins the outer one. A layer, object, block or tileset
command inside the transaction first flushes the pending cells, so peers see
the same order. If `fn` throws, the writes made so far are still flushed.

```ts
world.transaction(() => {
  for (const cell of island) {
    world.setVoxel("Ground", { position: cell, blockId: Block.Stone });
  }
});
```

#### `patchVoxels(layerName: string, cells: readonly number[]): void`

Applies a flat patch in a transaction. It emits `"voxels-patched"`, or nothing
when called through `apply()`. `cells` holds `VOXEL_PATCH_STRIDE` (5) numbers
per cell: `x, y, z, blockId, transform`, in world space. A `blockId` of `0`
removes the voxel. Throws a `RangeError` when the length is not a multiple
of 5.

```ts
world.patchVoxels("Ground", [
  0, 0, 0, 1, 0,
  1, 0, 0, 0, 0
]);

for (const { x, y, z, blockId } of voxelPatchCells(command.metadata.cells)) {
  // ...
}
```

#### `setVoxelAt(layerName: string, position: THREE.Vector3Like, entry: VoxelEntry): void`

#### `setPackedVoxelAt(layerName: string, position: THREE.Vector3Like, packed: PackedVoxel): void`

Writes a voxel directly and marks the affected and neighbouring chunks of every layer dirty for face re-evaluation.
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

### Block counts

Counts cover the stored voxels of every layer, whatever their visibility,
opacity or compositing. They are computed from per-chunk histograms cached
against `VoxelChunk.revision`, so only chunks written since the last query are
rescanned. [`VoxelInspector.blocks`](../core/VoxelInspector.md#block-statistics)
builds its registry-aware statistics on top of them.

#### `voxelCount: number`

Read-only total of stored voxels.

#### `countBlocks(): Map<number, number>`

Voxel count per block id across all layers. Returns a new map.

#### `countBlock(blockId: number): number`

Voxels of `blockId` across all layers; `0` when none.

### Commands

#### `apply(command: VoxelLayerCommand, logger?: VoxelLogger): void`

Replays a layer command onto this world without emitting it, so a network
adapter cannot echo it back. Every action of the union is handled; an unknown
one throws. On an engine, prefer `engine.apply()`, which emits it once with its
origin.

A voxel command naming a layer this world no longer has is dropped rather than
thrown, since a peer can still be painting a layer that was just merged or
removed here. The optional `logger` receives a warning for each dropped command;
without one the drop is silent. Local writes through `setVoxel` and
`setPackedVoxelAt` still throw for an unknown layer, which stays a programming
error.

#### `silently<T>(fn: () => T): T`

Runs `fn` with the `"command"` event muted and returns its result. Use it for
mutations peers already know about, such as deserializing a document.
`apply()` is built on it, and nesting is safe.

```ts
world.silently(() => deserializeVoxelWorld(snapshot, world));
```

### Object layer management

Object layers hold placed objects (spawn points, trigger zones, etc.) rather than
voxel data. They live in `world.objectLayers`, a `VoxelObjectLayers` keyed by
name, and are serialised as part of `VoxelWorldJSON`. Every change emits a
command on the world's `"command"` event.

```ts
class VoxelObjectLayers implements Iterable<VoxelObjectLayerJSON> {
  readonly size: number;
  toArray(): VoxelObjectLayerJSON[];
  get(name: string): VoxelObjectLayerJSON | undefined;
  add(name: string, options?: { visible?: boolean; order?: number; }): VoxelObjectLayerJSON;
  remove(name: string): boolean;
  update(name: string, patch: { visible?: boolean; }): boolean;
  addObject(layerName: string, object: VoxelObjectJSON): boolean;
  removeObject(layerName: string, objectId: string): boolean;
  moveObject(fromLayerName: string, objectId: string, toLayerName: string): boolean;
  updateObject(layerName: string, objectId: string, patch: Partial<VoxelObjectJSON>): boolean;
}
```

`add()` defaults `order` to the current object layer count and returns the new
descriptor. `toArray()` lists the layers in insertion order. The other methods
return `false` when a named layer or object is not found.

`moveObject()` keeps the same object instance and emits a single
`"object-moved"` command. It also returns `false` when both names resolve to
the same layer. Prefer it over `removeObject()` followed by `addObject()`: the
pair emits two independent commands, so two peers reparenting the same object at
once would each apply the other's add and leave the object duplicated in two
layers.
