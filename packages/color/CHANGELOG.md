# @jolly-pixel/color

## 3.0.0

### Major Changes

- [#1166](https://github.com/JollyPixel/editor/pull/1166) [`1172e00`](https://github.com/JollyPixel/editor/commit/1172e00ffa43d52a158fdf48ec47550cb856da6b) Thanks [@fraxken](https://github.com/fraxken)! - Add the immutable `Color` object (with `parseDraft` for typed text), `Gradient`, `PaletteFormat`, the picker `HueSpace`, `equalRGBA8`, `ByteColorInput` and `ColorSpace.channels`. They replace `parseColor`, `assertColor*`, `format*`, the byte `8` variants, `toRGBA8`/`fromRGBA8`, `contrastingColor`, `mixColor`, `colorRamp`, `shadeRamp`, `hsvToHsl`/`hslToHsv`, `ColorSpace.mix()`, `PaletteFile.parse()`/`serialize()`, `isOklchInGamut` and the sRGB transfer functions.
  Near-gray colors now convert to HSL, HSV and HWB as grays, `Color.oklch()` round-trips 8-bit colors, and `sortColors` returns the objects it was given.

### Minor Changes

- [#1164](https://github.com/JollyPixel/editor/pull/1164) [`505d6e0`](https://github.com/JollyPixel/editor/commit/505d6e0444dc3bc5bcb365486f085c169eb2caa8) Thanks [@fraxken](https://github.com/fraxken)! - `color` adds `shadeRamp`, `sortColors`, `isRGBA8` and `PaletteFile` (GPL and Lospec hex). `pixel-draw.renderer` palettes hold 1 to 256 colors (`COLOR_PALETTE_MAX_SIZE` replaces `COLOR_PALETTE_SIZE`) and sync whole edits as `palette-replaced`; `visibleColors` lists a texture's colors.
  Brushes get an `ink` (`blend` by default, `replace`, `lock-alpha`); `recordStroke` takes one color per pixel and `PixelDocument.paint(pixels, painter)` inks pixels. `jolly-color-picker` adds the `okhsl` space, an `eyedropper` button and hue wrap, paints the wheel at full value, and its wide layout gets a tool column and compact CSS hooks.

## 2.0.0

### Major Changes

- [#1083](https://github.com/JollyPixel/editor/pull/1083) [`d866130`](https://github.com/JollyPixel/editor/commit/d86613035c5f949c9449ce152bd5a8bcd570bac5) Thanks [@fraxken](https://github.com/fraxken)! - Add OKLCH/OKHSV/OKHSL behind one `ColorSpace` object per model (replaces the `rgbToX`/`xToRgb` pairs, keeps hue on grays), mixing, harmonies, byte-color helpers, `ColorSequence` (replaces `ColorPalette`/`colorFromKey`/`goldenAngleColor`) and WCAG `contrastingColor`, plus a configurable `jolly-color-picker` (spaces, wheel, channels, harmony, shared preferences).

### Patch Changes

- [#852](https://github.com/JollyPixel/editor/pull/852) [`09eabd6`](https://github.com/JollyPixel/editor/commit/09eabd676125ee69ac8e823815c62fd01b4feb5a) Thanks [@fraxken](https://github.com/fraxken)! - Faster hex and named-color parsing and hex/rgb formatting through lookup tables and packed-integer hex decoding.
  `parseColor` no longer resolves `Object.prototype` keys such as `constructor` to black.

## 1.1.1

### Patch Changes

- [#789](https://github.com/JollyPixel/editor/pull/789) [`b520e7e`](https://github.com/JollyPixel/editor/commit/b520e7e37c000763a492f68635af528ca461a285) Thanks [@fraxken](https://github.com/fraxken)! - Subpaths follow one naming scheme: `network/node` (now with the Vite plugin), `asset-server/{client,node}`, `asset-source/node`, `event-store/node` (was `./sqlite`), `image/browser` and `voxel.renderer/engine` (the Rapier plugin joins the root). `.ts` keys, wildcards, `network/parser` and `network/transport/*` are removed; transports ship from the network root, `./client` and `./node`.
  The `asset-server` and `asset-source` roots are now browser-safe and absorb `./backend`, `./kinds`, `./core` and `./indexeddb`; Node-only code moves to `./node`.
  Every published package declares `exports` instead of `main`/`types`, and the packages with no import-time side effects declare `"sideEffects": false`.

## 1.1.0

### Minor Changes

- [#668](https://github.com/JollyPixel/editor/pull/668) [`ab65462`](https://github.com/JollyPixel/editor/commit/ab65462597390541cdb2bee98a7aa22dff562c69) Thanks [@fraxken](https://github.com/fraxken)! - Add `layout="wide"` to `jolly-color-picker`: a height-filling row with vertical hue and alpha tracks and editable R/G/B, H/S/L, A and hex fields.
  Add `hsvToHsl()` and `hslToHsv()` to `@jolly-pixel/color`, keeping hue on grays and saturation through black.
