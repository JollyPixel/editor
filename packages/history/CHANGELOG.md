# @jolly-pixel/history

## 3.0.0

### Major Changes

- [#1101](https://github.com/JollyPixel/editor/pull/1101) [`c1a8763`](https://github.com/JollyPixel/editor/commit/c1a87634da5e6c17e86fc3a1f9fcec587d9a5f64) Thanks [@fraxken](https://github.com/fraxken)! - Rename `KeyedSnapshot` to `KeyedCapture` and `CommandDocument.apply` to `applyRemote`. Documents, histories and receipts no longer extend `Emitter`: listen with `on`/`off`.

### Minor Changes

- [#1231](https://github.com/JollyPixel/editor/pull/1231) [`40b7a52`](https://github.com/JollyPixel/editor/commit/40b7a52eb6d394cfb4959aeb07abe807fb599bb0) Thanks [@fraxken](https://github.com/fraxken)! - `CatalogClient.connect` accepts an abort `signal`, client logs can be redirected with `consoleLogger`, and clients can apply raw commands to a synced document.

- [#1095](https://github.com/JollyPixel/editor/pull/1095) [`40d00c4`](https://github.com/JollyPixel/editor/commit/40d00c45ca7946f8205cc8cdb01ff043af5d0c16) Thanks [@fraxken](https://github.com/fraxken)! - Add scene files, `LightComponent`, `MeshRenderer` and gizmos, and frames skip actors with nothing to update. `Camera.configure()` replaces the camera setters, and the `Behavior` property mirror is removed.

- [#1142](https://github.com/JollyPixel/editor/pull/1142) [`8a3c591`](https://github.com/JollyPixel/editor/commit/8a3c591b84dff46454fbad1717421400cad301c5) Thanks [@fraxken](https://github.com/fraxken)! - Add `TextDefinition`, and `TextRenderer` takes an `asset` or a `font`. Kinds can be import-only, and `SnapshotDocument` serves documents a client only reads.

### Patch Changes

- [#1213](https://github.com/JollyPixel/editor/pull/1213) [`7d1f07d`](https://github.com/JollyPixel/editor/commit/7d1f07da916e2f63622e4d3f49e24a4c4d3742ec) Thanks [@fraxken](https://github.com/fraxken)! - `jolly-pane-group` and `jolly-context-menu` no longer schedule an update from inside a finished one (Lit "change-in-update" warning).
  `CommandDocument` allows 32 listeners per event before the emitter warns about a leak.

## 2.0.0

### Major Changes

- [#1009](https://github.com/JollyPixel/editor/pull/1009) [`5af5621`](https://github.com/JollyPixel/editor/commit/5af5621e4223fb97ab38b22530a64c0884d52051) Thanks [@fraxken](https://github.com/fraxken)! - `ChangeReceipts.discard()`, its `discarded` event and the `dropped` refusal reason are removed: the network sync client no longer drops pending edits.

- [#1024](https://github.com/JollyPixel/editor/pull/1024) [`9123c45`](https://github.com/JollyPixel/editor/commit/9123c4578d791cb8f9d3749e56d2c8268ee87ec7) Thanks [@fraxken](https://github.com/fraxken)! - Rename methods named `xOf`, `xFor` or `getX`/`setX` after what they do (for example `inverseOf` → `invert`, `UVRegion.rectFor` → `slotRect`, `MessageParser.of` → `fromProtocol`).
  The package docs list the new names; behavior is unchanged.

### Minor Changes

- [#939](https://github.com/JollyPixel/editor/pull/939) [`a23ea74`](https://github.com/JollyPixel/editor/commit/a23ea74dca38f8684e890f0abed659277ccc230e) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - `CommandHistory` drops its `scopes` option: a scope starts with its first step and `removeScope()` drops it.
