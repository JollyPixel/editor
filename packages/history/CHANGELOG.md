# @jolly-pixel/history

## 2.0.0

### Major Changes

- [#1009](https://github.com/JollyPixel/editor/pull/1009) [`5af5621`](https://github.com/JollyPixel/editor/commit/5af5621e4223fb97ab38b22530a64c0884d52051) Thanks [@fraxken](https://github.com/fraxken)! - `ChangeReceipts.discard()`, its `discarded` event and the `dropped` refusal reason are removed: the network sync client no longer drops pending edits.

- [#1024](https://github.com/JollyPixel/editor/pull/1024) [`9123c45`](https://github.com/JollyPixel/editor/commit/9123c4578d791cb8f9d3749e56d2c8268ee87ec7) Thanks [@fraxken](https://github.com/fraxken)! - Rename methods named `xOf`, `xFor` or `getX`/`setX` after what they do (for example `inverseOf` → `invert`, `UVRegion.rectFor` → `slotRect`, `MessageParser.of` → `fromProtocol`).
  The package docs list the new names; behavior is unchanged.

### Minor Changes

- [#939](https://github.com/JollyPixel/editor/pull/939) [`a23ea74`](https://github.com/JollyPixel/editor/commit/a23ea74dca38f8684e890f0abed659277ccc230e) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - `CommandHistory` loses its `scopes` option: a scope starts with its first step and `removeScope()` drops it; `EMPTY_HISTORY_STATE` is exported and `HistoryScopeState.refused` is now readonly.
  `@jolly-pixel/ui/network` exports `presencePeerOf(peer)`, plus `markedPeers()` and `peerMarks()` to build a `PeerMarkMap` from presence values that carry more than a key.
