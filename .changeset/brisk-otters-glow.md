---
"@jolly-pixel/three": minor
---

Added `ColoredOutlineEntry.isolated` to `ColoredOutlinePass` (and `JumpFloodOutlinePass`) - the opposite of `priority`: an entry rendered from its own independent mask, never competing for the shared mask, so it can neither be cut by another entry nor cut one itself. `PeerColoredOutlinePass` now marks the local hover entry `isolated` instead of leaving it as a plain entry, so hovering something no longer clips a peer's selection ring just because it's nearer the camera.
