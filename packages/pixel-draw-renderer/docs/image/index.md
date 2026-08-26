# Image decoding

```ts
import { decodePng, InvalidPngError } from "@jolly-pixel/pixel-draw.renderer";

const { width, height, pixels } = await decodePng(bytes);
```

`decodePng` reads 8-bit, non-interlaced PNG images into `pixels`, an
`Uint8ClampedArray` of RGBA8 samples laid out row-major from the top-left
corner. Grayscale, truecolor, and indexed images are all expanded to RGBA;
indexed images honour a `tRNS` table, and images without alpha become opaque.
Chunk CRCs are not verified.

Anything it cannot read throws `InvalidPngError`: a payload that is not a PNG,
a bit depth other than 8, an interlaced image, an unknown color type, an
indexed image with no `PLTE` chunk, or an unknown scanline filter.

## Why a hand-written decoder

It runs unchanged in both environments, because inflation goes through
`DecompressionStream` rather than `node:zlib`. That covers the two places
where the platform will not decode an image:

- The seed pipeline runs in Node before any browser exists, and the server has
  no `createImageBitmap`.
- Safari has no `ImageDecoder`, and every canvas decoder premultiplies alpha,
  so `rgba(200, 100, 50, 3)` comes back as `rgba(170, 85, 85, 3)`.

`decodeRasterBlob` and `decodeRasterCanvas` therefore try `ImageDecoder` first,
fall back to `decodePng` for PNG payloads, and only then reach for a canvas.
Both lossless paths return the file's own samples with no color management
applied, which is what a pixel-art editor needs.

## Encoding

There is no matching encoder. Exporting goes through `canvas.toBlob`
(`encodeSelectionPng`), and the persisted document format is JSON rather than
PNG, since it carries UV regions that an image format cannot. See
[the asset kind](../asset/index.md).
