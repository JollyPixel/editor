---
"@jolly-pixel/three": minor
"@jolly-pixel/ui": patch
---

Added a selection subsystem for `THREE.Scene` objects: `SelectionManager` drives
per-object outlining (`SelectionOutline`, `SelectionBoundingBox` with optional
fill, `MergedSelectionOverlay` for bulk/instanced selections) and scene-level
postprocess techniques (`HighlightPass`, a JFA-based `HighlightPassJfa`), all
supporting `THREE.InstancedMesh` via `instanceId`. Techniques are open for
registration through `SelectionOverlayRegistry`.

Added network presence for selection and hover: `PeerSelectionRegistry`,
`PeerHoverRegistry`, and their overlay/postprocess renderers
(`PeerSelectionOverlays`, `PeerHighlightPass`, `PeerHoverOverlays`) show what
every connected peer is selecting and hovering, with `PeerSelectionChips` for
overlapping selectors and `PeerSelectionVisibility` for frustum/distance
gating. `PeerSelectionSync`/`PeerHoverSync` (`@jolly-pixel/three/network`)
publish and apply this state over a `@jolly-pixel/network` room's presence.

Fixed `@jolly-pixel/ui`'s `PropertyRow` `hidden` attribute doing nothing.
