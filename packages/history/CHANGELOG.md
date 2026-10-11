# @jolly-pixel/history

## 1.1.0

### Minor Changes

- [#939](https://github.com/JollyPixel/editor/pull/939) [`a23ea74`](https://github.com/JollyPixel/editor/commit/a23ea74dca38f8684e890f0abed659277ccc230e) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - `CommandHistory` loses its `scopes` option: a scope starts with its first step and `removeScope()` drops it; `EMPTY_HISTORY_STATE` is exported and `HistoryScopeState.refused` is now readonly.
  `@jolly-pixel/ui/network` exports `presencePeerOf(peer)`, plus `markedPeers()` and `peerMarks()` to build a `PeerMarkMap` from presence values that carry more than a key.
