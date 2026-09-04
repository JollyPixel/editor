# Raster API

The browser-only `raster` entry decodes image `Blob` objects to RGBA8 samples
or an `HTMLCanvasElement`.

```ts
import {
  decodeRaster,
  decodeRasterCanvas,
  type DecodedImage
} from "@jolly-pixel/image/raster";
```

## `decodeRaster()`

```ts
function decodeRaster(blob: Blob): Promise<DecodedImage>
```

The result uses the [`DecodedImage`](./png.md#decodedimage) layout. PNG input
with the `image/png` MIME type is decoded without canvas color conversion or
alpha premultiplication. For other formats, support and pixel conversion
depend on the browser's image decoders.

The promise rejects when none of the available browser decoders can read the
image or when a required canvas context is unavailable.

## `decodeRasterCanvas()`

```ts
function decodeRasterCanvas(blob: Blob): Promise<HTMLCanvasElement>
```

Returns a new canvas sized to the decoded image. The function writes decoded
RGBA samples with `putImageData()` when possible. Formats handled by the
browser may still be color-converted or alpha-premultiplied by the canvas
implementation.

## Runtime requirements

This entry uses browser APIs including `Blob`, `document`, canvas 2D, and one
or more image decoders. Set `blob.type` to the file's MIME type so the exact
PNG path and WebCodecs can identify the format.
