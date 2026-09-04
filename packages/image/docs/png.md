# PNG API

The root entry decodes supported PNG files to RGBA8 samples and encodes RGBA8
samples as PNG. It does not require a DOM.

```ts
import {
  decodePng,
  encodePng,
  InvalidPngError,
  type DecodedImage
} from "@jolly-pixel/image";
```

## `DecodedImage`

```ts
interface DecodedImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}
```

`data` contains straight-alpha RGBA8 samples in row-major order, starting at
the top-left pixel. Its length is `width * height * 4`.

## `decodePng()`

```ts
function decodePng(data: Uint8Array): Promise<DecodedImage>
```

`decodePng()` accepts non-interlaced, 8-bit PNG files with these color types:

- grayscale
- truecolor
- indexed color, including `tRNS` palette transparency
- grayscale with alpha
- truecolor with alpha

Grayscale and indexed samples are expanded to RGBA. Images without an alpha
channel receive alpha `255`. Color profiles are not applied, and chunk CRCs
are not checked.

The promise rejects with `InvalidPngError` when the PNG signature or required
structure is invalid, or when the image uses an unsupported bit depth, color
type, interlace method, or scanline filter. Decompression failures come from
the runtime's `DecompressionStream` implementation.

## `encodePng()`

```ts
function encodePng(image: DecodedImage): Promise<Uint8Array>
```

`encodePng()` writes an 8-bit, non-interlaced, truecolor-with-alpha PNG. It
does not mutate `image.data`.

Width and height must be positive 32-bit integers. A mismatched data length or
invalid dimension rejects with `InvalidPngError`.

Compression is provided by the runtime's `CompressionStream` implementation,
so encoded bytes can differ between runtimes. Decoding the result preserves
the input dimensions and samples.

## `InvalidPngError`

Use `InvalidPngError` to distinguish rejected PNG input from other runtime
errors:

```ts
try {
  await decodePng(bytes);
}
catch (error) {
  if (error instanceof InvalidPngError) {
    console.error(error.message);
  }
}
```
