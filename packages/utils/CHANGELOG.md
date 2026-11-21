# @jolly-pixel/utils

## 1.1.0

### Minor Changes

- [#1208](https://github.com/JollyPixel/editor/pull/1208) [`f5350de`](https://github.com/JollyPixel/editor/commit/f5350de576d82af8592928a4456f43702befff26) Thanks [@fraxken](https://github.com/fraxken)! - Asset-server exports `TEXTURE_EXTENSIONS`, the extension to MIME type table of the built-in texture kind.
  Utils adds `fileExtension(path)`, the lowercased extension of the last path segment.

- [#1235](https://github.com/JollyPixel/editor/pull/1235) [`a2e6a27`](https://github.com/JollyPixel/editor/commit/a2e6a27dc11dedbd444ea7698158f320f1cb4402) Thanks [@fraxken](https://github.com/fraxken)! - Add `DialogRequest`, `jolly-rail-group`, `jolly-message`, `jolly-fields`, `createExamplePane()` and ten shared built-in icons; floating rails now size their tool buttons, and built-ins no longer replace a glyph registered first.
  Add `pickFiles()` to `@jolly-pixel/utils/dom`.

- [#1234](https://github.com/JollyPixel/editor/pull/1234) [`90c9692`](https://github.com/JollyPixel/editor/commit/90c9692fc0508e2b784c097ed119090bfe07e850) Thanks [@fraxken](https://github.com/fraxken)! - Add `DistributiveOmit`, `DeepReadonly`, `Simplify`, `parseJsonObject`, `wrap`, `roundTo`, `delay`, `yieldToEventLoop`, `withTimeout`, `InFlight` and `sha256Hex` to `@jolly-pixel/utils`.
  The other packages drop their local copies of these helpers and import them from utils.

### Patch Changes

- [#1193](https://github.com/JollyPixel/editor/pull/1193) [`f998437`](https://github.com/JollyPixel/editor/commit/f998437cc19077ec578beaf254cc826407e378f5) Thanks [@fraxken](https://github.com/fraxken)! - `decodeBase64` skips its validation regex when `Uint8Array.fromBase64` exists and lets the strict native decoder reject malformed text, which saves 40 to 80 ms on a 7 MB model snapshot in Chrome.

- [#1200](https://github.com/JollyPixel/editor/pull/1200) [`974ed36`](https://github.com/JollyPixel/editor/commit/974ed36053e2e6aab2a71cbc7e47e3e0fcb77f58) Thanks [@fraxken](https://github.com/fraxken)! - `Teardown.defer` runs the step at once when the teardown has already run, instead of dropping it.
