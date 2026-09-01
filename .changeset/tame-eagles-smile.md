---
"@jolly-pixel/three": minor
---

Added `PeerSelectionVisibility`, optional frustum + max-distance gating for peer indicators - `PeerSelectionOverlays`/`PeerColoredOutlinePass` accept it via a new `visibility` option and skip rendering an indicator for any peer selection outside the camera frustum or beyond a configured distance. Fully opt-in; the local user's own selection is never gated.
