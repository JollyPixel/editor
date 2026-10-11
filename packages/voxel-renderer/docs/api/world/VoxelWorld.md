# VoxelWorld

The voxel layers, object layers and templates of a document, exposed as
`document.world`. Every edit goes through it. See
[the world model](../../concepts/world-model.md) for how layers stack.

```ts
const { world } = document;

world.addLayer("Ground");
world.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: 1 });
world.getVoxelAt({ x: 0, y: 0, z: 0 }); // { blockId: 1, transform: 0 }
```

## Coordinates and values

```ts
interface VoxelCoord {
  x: number;
  y: number;
  z: number;
}

interface VoxelEntry {
  blockId: number;
  transform: number;
  partner?: VoxelPart; // the second shape of a merged cell
}

interface VoxelPart {
  blockId: number;
  transform: number;
}
```

Any `THREE.Vector3Like` works where a `VoxelCoord` is expected. `blockId` is a
[`BlockDefinition`](../blocks/BlockDefinition.md) id; `0` is air and is never
stored. `transform` is a packed [`VoxelTransform`](./VoxelTransform.md). Reads
build a new entry each time, so compare entries by value. Allocation-free reads
return [packed voxels](./VoxelChunk.md#packed-voxels).

### Merged cells

A merged cell holds two shapes, each with its own block and transform, for
example a stone `slabBottom` under a wood `slabTop`. The second shape is the
entry's `partner`. A merged cell counts as one voxel; removing it removes both
shapes. Which shape is `partner` does not depend on the order they were
placed in.

The world stores any pair it is given. Whether two shapes complement each
other, filling the cell exactly once, is checked by
[`VoxelView.canMergeVoxelPart()`](../core/VoxelView.md#merging-shapes)
before writing.

#### `floorVoxelPosition(point: VoxelCoord): VoxelCoord`

The cell containing `point`; each component is floored, so `-0.2` gives `-1`.

#### `resolveSurfaceCell(point: VoxelCoord, normal: VoxelCoord, side?: "front" | "back"): VoxelCoord`

The cell on one side of a surface hit, such as a raycast result. `"front"`
(default) is the empty cell the surface faces, where a new block goes. `"back"`
is the cell that owns the surface. Works on slanted faces such as ramp slopes.

## Constructor

```ts
new VoxelWorld(chunkSize?: number) // default: 16
```

`chunkSize` must be a power of two, otherwise it throws a `RangeError`. A
[`VoxelDocument`](../core/VoxelDocument.md) creates its world for you.

| Property | Type | Description |
| --- | --- | --- |
| `chunkSize` | `number` | Read-only. |
| `objectLayers` | `VoxelObjectLayers` | See [voxel objects](#voxel-objects). |
| `templates` | `VoxelTemplates` | See [voxel templates](./VoxelTemplates.md). |
| `voxelCount` | `number` | Stored voxels in every layer, visible or not. |

## Events

```ts
type VoxelWorldEvents = {
  command: (command: VoxelWorldContentCommand) => void;
};
```

Every method that changes layers, voxels, object layers or templates emits one
[command](../core/commands.md) on `"command"`. `VoxelDocument` forwards these
as local commands. `mergeAllLayers()` and `clear()` emit nothing.

## Layers

Layer methods take names; commands carry layer ids.

#### `addLayer(name: string, options?: VoxelLayerConfigurableOptions): VoxelLayer`

Adds a layer on top of the stack. A taken name gets a ` (n)` suffix. See
[`VoxelLayer`](./VoxelLayer.md#options) for the options.

#### `getLayer(name: string): VoxelLayer | undefined`

#### `getLayerById(id: string): VoxelLayer | undefined`

#### `getLayers(): readonly VoxelLayer[]`

All layers, top of the stack first.

#### `uniqueLayerName(base: string): string`

`base`, or `base (n)` with the first free `n`.

#### `updateLayer(name: string, update: VoxelLayerUpdate): boolean`

Changes `name`, `visible`, `compositing` or `properties`. A taken name gets a
` (n)` suffix. Returns `false` for an unknown layer.

#### `removeLayer(name: string): boolean`

Returns `false` for an unknown layer.

#### `moveLayer(name: string, direction: "up" | "down"): void`

One step up or down the stack. Does nothing at the end of the stack.

#### `moveLayerTo(name: string, toIndex: number): void`

Moves the layer to an index of `getLayers()`, where `0` is the top. The index
is truncated and clamped to the stack. A move to the current index emits
nothing.

#### `cloneLayer(name: string, options?: Partial<VoxelLayerOptions>): VoxelLayer | undefined`

Copies a layer and its voxels under a new id, directly above the source.
Without `options.name` the copy is named `"<name> (1)"`, `"<name> (2)"` and so
on; a taken name is de-duplicated the same way. Returns `undefined` for an
unknown layer.

#### `mergeLayer(sourceName: string, targetName: string): boolean`

Merges the source into the target and removes the source. Where both hold a
voxel, the layer higher in the stack wins. The target keeps its visibility and
position; its own `properties` win over the source's. Returns `false` when a
layer is unknown or both names are the same layer.

#### `mergeAllLayers(options?: { except?: Iterable<string> }): VoxelLayer[]`

Collapses the layers into the lowest one, higher voxels winning. Layers named
in `except` keep their place; each run of layers between them merges into its
own lowest layer. Returns the remaining merged layers, top first. Emits no
command.

#### `setLayerPosition(name: string, position: VoxelCoord): void`

#### `translateLayer(name: string, delta: VoxelCoord): void`

Move the layer, and its voxels with it, in world space.

#### `rebaseLayer(name: string, position: VoxelCoord): void`

Moves the layer origin to `position` and keeps every voxel at the same world
position.

#### `transformLayer(name: string, transform: VoxelTransformOptions): void`

Turns and mirrors the layer content around the center of its voxels; the layer
position does not change. Applying the inverse restores the voxels exactly.
One command and one recorded write. Does nothing for the identity
transform or an empty layer.

The layer methods above that return nothing do nothing for an unknown layer.

#### `rankBetween(lower: string | null, upper: string | null): string`

A layer `rank` strictly between two ranks, for building a `"layer-moved"`
command by hand. `null` stands for the bottom or the top of the stack.

## Reading voxels

Reads look through the layers from the top and return the first visible voxel.
Rendering composites layers by other rules, described in
[layer compositing](../../concepts/world-model.md#layer-compositing).

#### `getVoxelAt(position: Vector3Like): VoxelEntry | undefined`

`undefined` for air.

#### `getPackedVoxelAt(position: Vector3Like): PackedVoxel`

`VOXEL_ABSENT` for air. The first shape only on a merged cell.

#### `getVoxelWithLayerAt(position: Vector3Like): { entry: VoxelEntry; layer: VoxelLayer } | undefined`

Also returns the layer the voxel comes from.

#### `getVoxelNeighbour(position: Vector3Like, face: Face): VoxelEntry | undefined`

The voxel next to `position` on the given face.

#### `countBlocks(): Map<number, number>`

#### `countBlock(blockId: number): number`

Voxel counts per block id over every layer, visible or not.

## Writing voxels

Positions are world positions. Each call emits one command and one recorded
write unless it runs inside a transaction. Placing a voxel in an unknown layer throws;
removing from one does nothing.

#### `setVoxel(layerName: string, options: VoxelSetOptions): void`

Places a voxel and emits `"voxel-set"`.

```ts
interface VoxelSetOptions extends VoxelTransformOptions {
  position: Vector3Like;
  blockId: number;
  merge?: boolean; // default: false
}
```

`rotation`, `flipX`, `flipZ` and `flipY` are the
[`VoxelTransform` options](./VoxelTransform.md#options). A voxel replaces
both shapes of a merged cell. With `merge`, a voxel set on an occupied cell
that is not merged yet becomes its second shape instead; on any other cell it
is written as usual.

```ts
world.setVoxel("Ground", { position, blockId: kSlabBottom });
world.setVoxel("Ground", { position, blockId: kSlabTop, merge: true });
```

#### `removeVoxel(layerName: string, options: { position: Vector3Like }): void`

Emits `"voxel-removed"`. Removes both shapes of a merged cell.

#### `setVoxelBulk(layerName: string, entries: VoxelSetOptions[]): void`

#### `removeVoxelBulk(layerName: string, entries: { position: Vector3Like }[]): void`

One `"voxels-set"` or `"voxels-removed"` command for the whole batch.

```ts
world.setVoxelBulk("Ground", [
  { position: { x: 0, y: 0, z: 0 }, blockId: 1 },
  { position: { x: 1, y: 0, z: 0 }, blockId: 2, rotation: VoxelRotation.CW90 }
]);
```

#### `removeBlocks(blockIds: Iterable<number>): number`

Removes every voxel of the given blocks from every layer, for example after
deleting a block. A merged cell that keeps one shape of another block keeps
that shape. Returns how many cells it changed.

#### `transaction<T>(fn: () => T): T`

Runs `fn` and returns its result. Writes land immediately; the commands they
emit are held until `fn` returns and go out as one `"voxels-patched"` per
layer, holding only the cells that changed. The transaction is one history
step. Transactions nest. If `fn` throws, the writes made so far are still
emitted.

```ts
world.transaction(() => {
  for (const cell of island) {
    world.setVoxel("Ground", { position: cell, blockId: 1 });
  }
});
```

#### `patchVoxels(layerName: string, cells: readonly number[], partners?: readonly number[]): void`

Writes `VOXEL_PATCH_STRIDE` (5) numbers per cell, `x, y, z, blockId,
transform`, and emits them as one `"voxels-patched"`. A `blockId` of `0`
removes the voxel. `partners` gives the second shape of merged cells,
`VOXEL_PATCH_PARTNER_STRIDE` (3) numbers each: `cell, blockId, transform`,
where `cell` is the index of a non-air cell of `cells`; a cell without one is
not merged. The fastest way to write generated terrain. Throws a `RangeError`
when a length is not a multiple of its stride or a partner targets no voxel,
before writing anything, or for an invalid block id, after writing the cells
before it.

```ts
world.patchVoxels("Ground", [
  0, 0, 0, 1, 0,
  1, 0, 0, 0, 0
]);

// cell 1 holds block 1 merged with block 2
world.patchVoxels("Ground", [
  0, 0, 0, 1, 0,
  1, 0, 0, 1, 0
], [1, 2, 0]);
```

`voxelPatchCells(cells)` iterates a patch as `{ x, y, z, blockId, transform }`
objects, for example to read a received command.

#### `clear(): void`

Removes every voxel layer, object layer and template. Emits nothing.

## Applying commands

#### `applyCommand(command: VoxelWorldContentCommand, logger?: VoxelLogger): VoxelWorldContentCommand | null`

Replays a command, for example one received from a peer, without emitting it.
On a document, use [`document.applyCommand()`](../core/VoxelDocument.md) instead.

Returns the command as this world applied it, or `null` when nothing changed: a
`"layer-moved"` index comes back clamped, a `"cloned"` name unique, and
`"voxels-patched"` keeps only the cells that changed. A voxel command for an
unknown layer returns `null` and logs a warning on `logger`. An unknown action
throws.

#### `silently<T>(fn: () => T): T`

Runs `fn` with the `"command"` event muted. Use it for changes peers already
have. Nests.

## Recorders

A recorder receives the cells changed by each emitted voxel write, read before
the write. An undo history builds the inverse of each command from them.

```ts
interface VoxelEditRecorder {
  record(changes: VoxelCellChange[]): void;
}

interface VoxelCellChange {
  layerId: string;
  position: VoxelCoord;
  before: PackedVoxel; // VOXEL_ABSENT when the cell was empty
  after: PackedVoxel; // VOXEL_ABSENT when the cell was cleared
  beforePartner: PackedVoxel; // VOXEL_ABSENT unless merged before
  afterPartner: PackedVoxel; // VOXEL_ABSENT unless merged after
}
```

#### `addRecorder(recorder: VoxelEditRecorder, options?: { includeUnrecorded?: boolean }): void`

#### `removeRecorder(recorder: VoxelEditRecorder): boolean`

`removeRecorder()` returns `false` when the recorder was not added.

#### `unrecorded<T>(fn: () => T): T`

Runs `fn`; its writes reach only recorders added with `includeUnrecorded`.

## Voxel objects

Object layers hold placed objects such as spawn points and trigger zones. They
live in `world.objectLayers`, keyed by name, and are saved with the world.
Object coordinates may be fractional.

```ts
world.objectLayers.add("Spawns");
world.objectLayers.addObject("Spawns", {
  id: "player",
  name: "Player",
  x: 4,
  y: 1,
  z: 4,
  visible: true
});
```

```ts
interface VoxelObjectJSON {
  id: string; // unique within its layer
  name: string;
  type?: string;
  x: number;
  y: number;
  z: number;
  width?: number;
  height?: number;
  rotation?: number;
  visible: boolean;
  color?: string;
  locked?: boolean;
  properties?: Record<string, string | number | boolean>;
}

interface VoxelObjectLayerJSON {
  id: string;
  name: string;
  visible: boolean;
  order: number;
  objects: VoxelObjectJSON[];
}
```

Property values other than strings, numbers and booleans are dropped when the
world is saved.

### VoxelObjectLayers

Every change emits an object layer command on the world's `"command"` event.
The methods returning `boolean` return `false` when the named layer or object
does not exist.

| Member | Description |
| --- | --- |
| `size` | Number of object layers. |
| `toArray()` | Layers in insertion order. |
| `get(name)` | A layer, or `undefined`. |
| `getObject(layerName, objectId)` | An object, or `undefined`. |
| `add(name)` | Adds a visible layer and returns it. |
| `remove(name)` | Removes a layer and its objects. |
| `update(name, { visible })` | Shows or hides a layer. |
| `addObject(layerName, object)` | Adds an object. |
| `removeObject(layerName, objectId)` | Removes an object. |
| `updateObject(layerName, objectId, patch)` | Merges `patch` into an object. |
| `moveObject(fromLayerName, objectId, toLayerName)` | Moves an object to another layer. `false` when both names are the same layer. |

Use `moveObject()` rather than `removeObject()` followed by `addObject()`: it
emits one command, so two peers moving the same object at once cannot duplicate
it.

### VoxelFootprint

The whole-cell area an object covers on the ground, `width` along x and
`height` along z.

```ts
const footprint = VoxelFootprint.fromObject(object);

footprint.equals(new VoxelFootprint(2, 1));
```

| Member | Description |
| --- | --- |
| `new VoxelFootprint(width, height)` | Each extent is rounded to a whole cell, at least `1`. |
| `VoxelFootprint.fromObject(object)` | The footprint of an object; a missing `width` or `height` counts as `1`. |
| `VoxelFootprint.Unit` | A 1×1 footprint. |
| `VoxelFootprint.normalizeExtent(value)` | Rounds to a whole cell; zero, negative and invalid values give `1`. |
| `width`, `height` | Read-only. |
| `equals(other)` | Compares by value. |
| `toJSON()` | `{ width, height }`, ready to spread into an object or a patch. |
