---
"@jolly-pixel/history": minor
"@jolly-pixel/ui": minor
---

`CommandHistory` loses its `scopes` option: a scope starts with its first step and `removeScope()` drops it; `EMPTY_HISTORY_STATE` is exported and `HistoryScopeState.refused` is now readonly.
`@jolly-pixel/ui/network` exports `presencePeerOf(peer)`, plus `markedPeers()` and `peerMarks()` to build a `PeerMarkMap` from presence values that carry more than a key.
