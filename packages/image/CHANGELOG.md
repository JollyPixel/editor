# @jolly-pixel/image

## 2.0.1

### Patch Changes

- [#851](https://github.com/JollyPixel/editor/pull/851) [`797aeb9`](https://github.com/JollyPixel/editor/commit/797aeb960560778e6f71219197859bb001f2045a) Thanks [@fraxken](https://github.com/fraxken)! - Faster PNG encoding and decoding: specialized branchless scanline filters, a single-pass adaptive filter score, SWAR unfiltering, palette lookup tables, a zero-copy RGBA path, slicing-by-8 CRC-32, and inflation into a preallocated buffer.

## 2.0.0

### Major Changes

- [#789](https://github.com/JollyPixel/editor/pull/789) [`b520e7e`](https://github.com/JollyPixel/editor/commit/b520e7e37c000763a492f68635af528ca461a285) Thanks [@fraxken](https://github.com/fraxken)! - Subpaths follow one naming scheme: `network/node` (now with the Vite plugin), `asset-server/{client,node}`, `asset-source/node`, `event-store/node` (was `./sqlite`), `image/browser` and `voxel.renderer/engine` (the Rapier plugin joins the root). `.ts` keys, wildcards, `network/parser` and `network/transport/*` are removed; transports ship from the network root, `./client` and `./node`.
  The `asset-server` and `asset-source` roots are now browser-safe and absorb `./backend`, `./kinds`, `./core` and `./indexeddb`; Node-only code moves to `./node`.
  Every published package declares `exports` instead of `main`/`types`, and the packages with no import-time side effects declare `"sideEffects": false`.

### Patch Changes

- [#825](https://github.com/JollyPixel/editor/pull/825) [`b19efe6`](https://github.com/JollyPixel/editor/commit/b19efe62f02a41cccb67a846c7066d6bf3337c76) Thanks [@fraxken](https://github.com/fraxken)! - `decodeRaster()` and `decodeRasterCanvas()` keep the WebCodecs frame open until its copy finishes and now require `createImageBitmap()`.
  `decodePng()` rejects truncated image data with `InvalidPngError` and decodes faster.

## 1.1.0

### Minor Changes

- [#564](https://github.com/JollyPixel/editor/pull/564) [`1541725`](https://github.com/JollyPixel/editor/commit/1541725c977cc4b74cf05045c2674585150a1383) Thanks [@fraxken](https://github.com/fraxken)! - Initial release. A DOM-free `decodePng` / `encodePng` pair speaking flat RGBA8,
  plus a `raster` entry whose decoder ladder prefers exact paths over a
  premultiplying canvas. Extracted from `@jolly-pixel/pixel-draw.renderer`.
