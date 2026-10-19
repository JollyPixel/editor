---
"@jolly-pixel/three": major
---

`PeerHighlights` and `PeerHighlightSync` replace the peer selection/hover registries and syncs; `MeshHighlight` keeps its state private and re-syncs instead of rebuilding on `configure()`.
Removed `MeshHighlightState`, `HighlightResolver`, `PeerHighlightPass` and the peer overlay classes from the public API.
`BoxControls` gains `cancel()` and Escape, and its `end` event reports `changed` and `cancelled`.
