# FillTool

`FillTool` is a pure, stateless paint-bucket flood-fill algorithm. It has no knowledge of the brush, the DOM, or how its result gets committed — it reads pixels through the `DefaultPixelBuffer` interface and returns the set of positions to fill; `CanvasManager` owns turning that into an actual edit (see [`commitPixels`](./CanvasManager.md#commitpixels)).

`CanvasManager` calls `FillTool.floodFill` in response to `InputController`'s `onFillStart` report, fired on left-click while in `"fill"` mode. You normally won't call it directly.

## Methods

### `FillTool.floodFill` (static)

```ts
static floodFill(buffer: DefaultPixelBuffer, seed: Vec2, fillColor: RGBA): Vec2[]
```

Computes the 4-directionally connected region of pixels reachable from `seed` whose color exactly matches the seed pixel's current color (an iterative stack-based traversal — never recursive, so it can't stack-overflow on large regions).

- **Connectivity**: orthogonal neighbors only (up/down/left/right). A diagonal, differently-colored line blocks the fill from leaking through a diagonal gap — matching the convention used by MS Paint, GIMP, and Photoshop.
- **Color matching**: exact RGBA equality, no tolerance. There is no anti-aliasing or blending anywhere pixels are written in this package, so there is nothing for a tolerance threshold to compensate for.
- **No-op guard**: returns `[]` immediately, without traversing anything, when `seed` is out of bounds or its current color already equals `fillColor` — the resulting fill would be visually indistinguishable from doing nothing.
- Reads exclusively through `buffer.samplePixel(x, y)` — the public `DefaultPixelBuffer` interface — so it works against any conforming buffer (including test mocks) with no knowledge of the underlying pixel array layout.

`CanvasManager` derives `fillColor` from the current brush color and opacity (the same `getColorAsRGBA(brush.getColor())` conversion used everywhere else pixels are drawn), so a fill respects the brush's current opacity exactly like a normal stroke.
