# UVBounds

The area that UV edits keep regions in: the texture, extended by [`UVMap.overflow`](./UVMap.md#overflow) texture pixels past each edge. Read it from [`UVMap.bounds`](./UVMap.md#bounds). It is immutable; changing the canvas size or `overflow` gives a new value on the next read.

```ts
const { bounds } = canvas.uv;

bounds.fit({ x: -40, y: 2, width: 8, height: 8 });
// with a 32x32 texture and overflow 4: { x: -4, y: 2, width: 8, height: 8 }
```

## Properties

### `size` / `overflow`

```ts
readonly size: Vec2
readonly overflow: number
```

The texture size and the overflow the area was built from.

### `limit`

```ts
get limit(): SelectionRect | null
```

The whole area as a rect, starting at `-overflow, -overflow`. It is `null` when `overflow` is `0`, because the area is the texture itself, or `Infinity`, because there is no edge to show. UV mode draws this rect as the "UV limit" outline.

## Methods

### `fit(rect)`

```ts
fit(rect: SelectionRect): SelectionRect
```

Returns `rect` moved the least distance needed to sit inside the area. The size never changes. A rect wider or taller than the area is pinned to its top or left edge and hangs off the far one.

### `clamp(region, slot?)`

```ts
clamp(region: UVRegion, slot?: UVSlot | null): UVRegion
```

Fits one slot of `region`, or the whole region when `slot` is `null`, which is the default. A whole region keeps its shape and moves as one piece.

### `move(region, position, slot)`

```ts
move(region: UVRegion, position: Vec2, slot: UVSlot | null): UVRegion
```

Places one slot, or the whole region when `slot` is `null`, at `position`, then fits it. This is how [`UVMap.move()`](./UVMap.md#moveid-rect-slot) clamps.

### `resize(region, rect, slot, options)`

```ts
resize(
  region: UVRegion,
  rect: SelectionRect,
  slot: UVSlot | null,
  options: UVResizeOptions
): UVRegion
```

Resizes like [`UVRegion.resized()`](./UVRegion.md#resizedrect-slot-options), with sizes raised to at least 1px. An edge that would cross the area's border stops on it. A region already past the border keeps its position but cannot grow further out. This is how [`UVMap.resize()`](./UVMap.md#resizeid-rect-slot-options) clamps.
