# CanvasBuffer

Internal DOM adapter around [`PixelBuffer`](./PixelBuffer.md). `PixelArtCanvas` uses it to keep raw pixels and an `HTMLCanvasElement` in sync. It is not exported from the package root.

`canvas()` returns the working canvas, and `loadTexture()` replaces its contents from a canvas or image.

## Events

| Event | Payload | Emitted by |
|---|---|---|
| `changed` | `{ bounds: SelectionRect }` | `drawPixels`, `drawColorGroups`, `drawMaskedRegion` |
| `resized` | `{ size: Vec2 }` | `resize` |
| `replaced` | `{ size: Vec2 }` | `loadTexture`, `replacePixels` |

`bounds` is the area the mutation touched: the bounding box of the written positions for the pixel paths and the target rect for `drawMaskedRegion`. A consumer holding a texture over `canvas()` can repaint just that area.

`resized` and `replaced` are distinct because they mean different things downstream. `resize()` keeps the same canvas *element* and only changes its dimensions, so a bound texture needs a refresh flag. `loadTexture()` and `replacePixels()` replace the whole texture, so a bound texture re-uploads it.

`copyToMaster()` emits nothing.

`PixelDocument` forwards all three, and `PixelArtCanvas.document` exposes it.

Unlike `PixelBuffer.pixels()`, `CanvasBuffer.pixels()` returns a copy. `pixels({ copy: false })` returns the working pixels themselves, for a reader that must not allocate per frame; do not write to them.

## Reading pixels

`samplePixel(x, y)` and `samplePixels(positions)` read the working pixels, the same data the canvas shows and the colour picker reads. See [`PixelBuffer`](./PixelBuffer.md#samplepixelx-y) for their return shapes. A consumer reads through the document:

```ts
const [r, g, b, a] = canvas.document.buffer.samplePixel(3, 5);
```

A pixel outside the texture reads as transparent black.
