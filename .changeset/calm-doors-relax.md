---
"@jolly-pixel/three": minor
---

Added an optional translucent fill to `SelectionBoundingBox` (`fillOpacity`, default `0` - off), tinting a selected group's own volume in addition to its existing wireframe. Configurable via `SelectionManagerOptions.boundingBox`/`SelectionManager.setBoundingBoxOptions`, and honored by peer group selections through `PeerSelectionOverlays` too.
