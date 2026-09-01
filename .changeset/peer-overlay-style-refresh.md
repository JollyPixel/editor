---
"@jolly-pixel/three": patch
---

`PeerSelectionOverlays` now re-applies x-ray on refresh and gained `refreshAll()` for style changes that dispatch no event; `SelectionOverlay` gained optional `setFillOpacity`; `SelectionBoundingBox.setFillOpacity` now builds its fill mesh on demand instead of being a permanent no-op when built with `fillOpacity: 0`.
