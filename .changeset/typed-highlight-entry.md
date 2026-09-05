---
"@jolly-pixel/three": patch
---

Remove every type assertion from the selection sources: `HighlightEntry` is now
a discriminated union on `instanceId`, and the peer registries type their
`addEventListener`/`removeEventListener` on a per-class event map.
