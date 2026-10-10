# UVNet

Decides where [`UVRegion.unfold()`](./UVRegion.md#unfoldnet) puts each active slot. The default net packs the slots into the smallest box it can find. A grid net gives every slot a fixed cell, for meshes whose UVs must always unfold into the same shape.

```ts
import { UVNet } from "@jolly-pixel/pixel-draw.renderer";

canvas.uv.net = new UVNet([
  [null, "top", "bottom"],
  ["right", "front", "left", "back"]
]);
```

## Types

```ts
type UVNetRow = readonly (UVSlot | null)[];
```

## Constructor

```ts
new UVNet(rows?: Iterable<Iterable<UVSlot | null>>)
```

Without `rows`, the net packs. With `rows`, each inner iterable is one grid row, read top to bottom, and `null` leaves a cell empty. Rows may have different lengths.

Throws a `RangeError` when the grid holds no slot or lists one slot twice.

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

A frozen copy of the grid, or `null` for a packing net.

## Methods

### `place(cells, origin)`

```ts
place(
  cells: readonly { face: UVSlot; geometry: UVGeometry; }[],
  origin: Vec2
): Map<UVSlot, UVGeometry>
```

Returns the geometry of each cell moved into the net, with the net's top-left corner at `origin`. Sizes, shapes and rotations are kept.

In a grid, each column is as wide as its widest slot and each row as tall as its tallest, and a slot sits at the top-left of its cell. Slots of different sizes never overlap, but a smaller slot leaves a gap beside or below it. A cell whose slot is not given, such as an inactive slot, stays empty, so the other slots keep their place. When a given slot has no cell in the grid, the whole set is packed as `UVNet.packed` would.
