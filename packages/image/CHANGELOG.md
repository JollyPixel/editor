# @jolly-pixel/image

## 2.1.0

### Minor Changes

- [#1016](https://github.com/JollyPixel/editor/pull/1016) [`5df8953`](https://github.com/JollyPixel/editor/commit/5df89531ef26fe891a7ef5ed6144ea8dc2155bee) Thanks [@fraxken](https://github.com/fraxken)! - `encodePng` takes an optional row `filter`, shrinking tileset snapshots by about 40%. Base64 uses native APIs and `js-base64` is dropped.

### Patch Changes

- [#851](https://github.com/JollyPixel/editor/pull/851) [`797aeb9`](https://github.com/JollyPixel/editor/commit/797aeb960560778e6f71219197859bb001f2045a) Thanks [@fraxken](https://github.com/fraxken)! - Faster PNG encoding and decoding: specialized branchless scanline filters, a single-pass adaptive filter score, SWAR unfiltering, palette lookup tables, a zero-copy RGBA path, slicing-by-8 CRC-32, and inflation into a preallocated buffer.

## 2.0.0

### Major Changes

- [#789](https://github.com/JollyPixel/editor/pull/789) [`b520e7e`](https://github.com/JollyPixel/editor/commit/b520e7e37c000763a492f68635af528ca461a285) Thanks [@fraxken](https://github.com/fraxken)! - Package subpaths follow one naming scheme (`/node`, `/client`, `/browser`), and every package declares `exports`; for example, import `event-store/node` instead of `event-store/sqlite`. Package roots are browser-safe.

### Patch Changes

- [#825](https://github.com/JollyPixel/editor/pull/825) [`b19efe6`](https://github.com/JollyPixel/editor/commit/b19efe62f02a41cccb67a846c7066d6bf3337c76) Thanks [@fraxken](https://github.com/fraxken)! - `decodeRaster()` and `decodeRasterCanvas()` keep the WebCodecs frame open until its copy finishes and now require `createImageBitmap()`.
  `decodePng()` rejects truncated image data with `InvalidPngError` and decodes faster.

## 1.1.0

### Minor Changes

- [#564](https://github.com/JollyPixel/editor/pull/564) [`1541725`](https://github.com/JollyPixel/editor/commit/1541725c977cc4b74cf05045c2674585150a1383) Thanks [@fraxken](https://github.com/fraxken)! - Initial release. A DOM-free `decodePng` / `encodePng` pair speaking flat RGBA8,
  plus a `raster` entry whose decoder ladder prefers exact paths over a
  premultiplying canvas. Extracted from `@jolly-pixel/pixel-draw.renderer`.
