# @jolly-pixel/color

## 3.0.0

### Major Changes

- [#1166](https://github.com/JollyPixel/editor/pull/1166) [`1172e00`](https://github.com/JollyPixel/editor/commit/1172e00ffa43d52a158fdf48ec47550cb856da6b) Thanks [@fraxken](https://github.com/fraxken)! - Add the immutable `Color` object and `Gradient`, which replace the `parseColor`, `format*`, mixing and ramp functions. Near-gray colours now convert as grays.

### Minor Changes

- [#1164](https://github.com/JollyPixel/editor/pull/1164) [`505d6e0`](https://github.com/JollyPixel/editor/commit/505d6e0444dc3bc5bcb365486f085c169eb2caa8) Thanks [@fraxken](https://github.com/fraxken)! - Palettes hold 1 to 256 colours (`COLOR_PALETTE_MAX_SIZE` replaces `COLOR_PALETTE_SIZE`), brushes get an `ink` mode, and the colour picker adds OKHSL and an eyedropper.

## 2.0.0

### Major Changes

- [#1083](https://github.com/JollyPixel/editor/pull/1083) [`d866130`](https://github.com/JollyPixel/editor/commit/d86613035c5f949c9449ce152bd5a8bcd570bac5) Thanks [@fraxken](https://github.com/fraxken)! - Add OKLCH, OKHSV and OKHSL colour spaces, harmonies and `ColorSequence` (which replaces `ColorPalette`), plus a configurable `jolly-color-picker`.

### Patch Changes

- [#852](https://github.com/JollyPixel/editor/pull/852) [`09eabd6`](https://github.com/JollyPixel/editor/commit/09eabd676125ee69ac8e823815c62fd01b4feb5a) Thanks [@fraxken](https://github.com/fraxken)! - Faster hex and named-color parsing and hex/rgb formatting through lookup tables and packed-integer hex decoding.
  `parseColor` no longer resolves `Object.prototype` keys such as `constructor` to black.

## 1.1.1

### Patch Changes

- [#789](https://github.com/JollyPixel/editor/pull/789) [`b520e7e`](https://github.com/JollyPixel/editor/commit/b520e7e37c000763a492f68635af528ca461a285) Thanks [@fraxken](https://github.com/fraxken)! - Package subpaths follow one naming scheme (`/node`, `/client`, `/browser`), and every package declares `exports`; for example, import `event-store/node` instead of `event-store/sqlite`. Package roots are browser-safe.

## 1.1.0

### Minor Changes

- [#668](https://github.com/JollyPixel/editor/pull/668) [`ab65462`](https://github.com/JollyPixel/editor/commit/ab65462597390541cdb2bee98a7aa22dff562c69) Thanks [@fraxken](https://github.com/fraxken)! - Add `layout="wide"` to `jolly-color-picker`, and `hsvToHsl()`/`hslToHsv()` to `@jolly-pixel/color`.
