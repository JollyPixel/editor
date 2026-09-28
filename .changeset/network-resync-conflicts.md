---
"@jolly-pixel/network": minor
"@jolly-pixel/asset-server": minor
"@jolly-pixel/pixel-draw.renderer": minor
---

Asset rooms clamp future command timestamps and send the author a snapshot after a refused, narrowed or unappended command; `CommandSync` replays its own echoes a snapshot overtook and adds `whenReady()`. `ConflictTracker` records headers only and gains `reset()`; `commandVariant()` and `withCommandHeader()` build command schemas, and `seq` must be a non-negative integer.
`PixelDocument` emits `buffer-updated` next to its `onBufferUpdated` hook; `AssetRoomNotice` names the asset room notice union.
