# CanvasBuffer

Internal DOM adapter around [`PixelBuffer`](./PixelBuffer.md). `PixelArtCanvas` uses it to keep raw pixels and an `HTMLCanvasElement` in sync. It is not exported from the package root.

`canvas()` returns the working canvas, and `loadTexture()` replaces its contents from a canvas or image.

## Events

| Event | Payload | Emitted by |
|---|---|---|
| `changed` | `{ bounds: SelectionRect }` | `drawPixels`, `drawColorGroups`, `drawRegion`, `drawMaskedRegion` |
| `resized` | `{ size: Vec2 }` | `resize` |
| `replaced` | `{ size: Vec2 }` | `loadTexture` |

`bounds` is the area the mutation touched: the bounding box of the written positions for the pixel paths, and the target rect for the region paths. A consumer holding a texture over `canvas()` can repaint just that area.

`resized` and `replaced` are distinct because they mean different things downstream. `resize()` keeps the same canvas *element* and only changes its dimensions, so a bound texture needs a refresh flag. `loadTexture()` swaps the element, so a bound texture has to re-point at the new one.

None of the three fire for `replacePixels()` or `copyToMaster()`; callers drive those explicitly.

`PixelDocument` forwards all three, and `PixelArtCanvas.document` exposes it.

Unlike `PixelBuffer.pixels()`, `CanvasBuffer.pixels()` returns a copy.
