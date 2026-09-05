---
"@jolly-pixel/three": minor
---

Trim the selection public surface to its user-facing components: the internal
overlay plumbing, factories and helpers are no longer exported. The global
`defaultSelectionOverlayRegistry` is replaced by a per-instance
`SelectionManager.overlayRegistry`, and `createSelectionOverlay` becomes
`SelectionOverlayRegistry.create`.
