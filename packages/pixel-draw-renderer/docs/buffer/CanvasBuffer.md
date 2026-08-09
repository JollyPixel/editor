# CanvasBuffer

Internal DOM adapter around [`PixelBuffer`](./PixelBuffer.md). `PixelArtCanvas` uses it to keep raw pixels and an `HTMLCanvasElement` in sync. It is not exported from the package root.

`canvas()` returns the working canvas, and `loadTexture()` replaces its contents from a canvas or image. Drawing methods update the affected canvas area and emit `"changed"`. Resize and replacement operations update the full canvas without emitting that event.

Unlike `PixelBuffer.pixels()`, `CanvasBuffer.pixels()` returns a copy.
