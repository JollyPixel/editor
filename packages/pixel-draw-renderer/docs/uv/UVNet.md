# UVNet

Decides where [`UVRegion.unfold()`](./UVRegion.md#unfoldnet) puts each active slot. The default net packs the slots into the smallest box it can find. A grid net gives every slot a fixed cell, for meshes whose UVs must always unfold into the same shape.

```ts
import { UVNet } from "@jolly-pixel/pixel-draw.renderer";

canvas.uv.net = new UVNet([
  [null, "top", "bottom"],
  ["right", "front", "left", "back"]
]);
```

A cell can hold several slots. They share one rectangle, so a block whose top and bottom look alike, and whose four sides look alike, unfolds into two cells:

```ts
canvas.uv.net = new UVNet([
  [["top", "bottom"], ["front", "back", "left", "right"]]
]);
```

## Types

```ts
type UVNetCell = readonly UVSlot[];
type UVNetRow = readonly (UVNetCell | null)[];
type UVNetCellInput = UVSlot | Iterable<UVSlot> | null;
```

## Constructor

```ts
new UVNet(rows?: Iterable<Iterable<UVNetCellInput>>)
```

Without `rows`, the net packs. With `rows`, each inner iterable is one grid row, read top to bottom. A cell is one slot, several slots that share it, or `null` to leave it empty; an empty list counts as `null`. Rows may have different lengths.

Throws a `RangeError` when the grid holds no slot or lists one slot twice, even in two different cells.

## Properties

### `packed`

```ts
static readonly packed: UVNet
```

The packing net, used whenever no other net is given. It places the tallest slot first and keeps the arrangement whose bounding box has the smallest perimeter, then the smallest area. Six equal faces give a 2x3 net.

### `rows`

```ts
readonly rows: readonly UVNetRow[] | null
```

A frozen copy of the grid, or `null` for a packing net. Every cell is a frozen list of slots, even one given as a single slot, and empty cells are `null`.

## Methods

### `missingSlots(slots)`

```ts
missingSlots(slots: Iterable<UVSlot>): UVSlot[]
```

Returns the given slots that have no cell in the grid, in the order given. The packing net fits every slot and returns an empty array. A net fits a region when this is empty for its active slots; otherwise `place()` packs instead.

### `place(faces, origin)`

```ts
place(
  faces: readonly { face: UVSlot; geometry: UVGeometry; }[],
  origin: Vec2
): Map<UVSlot, UVGeometry>
```

Returns the geometry of each face moved into the net, with the net's top-left corner at `origin`. Shapes and rotations are kept, and so are sizes, except for slots sharing a cell.

In a grid, each column is as wide as its widest cell and each row as tall as its tallest, and a cell sits at the top-left of its grid square. A cell takes the size of its first listed slot that is given, and every other slot in it is resized onto that rectangle, keeping its shape and rotation. Cells of different sizes never overlap, but a smaller cell leaves a gap beside or below it. A cell whose slots are not given, such as inactive slots, stays empty, so the other cells keep their place; a row or column left with no cell at all takes no space. When a given slot has no cell in the grid, the whole set is packed as `UVNet.packed` would.
