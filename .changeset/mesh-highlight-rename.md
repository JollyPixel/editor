---
"@jolly-pixel/three": major
---

Rename the `selection` module to `mesh-highlight`: `SelectionSystem` becomes
`MeshHighlight`, `SelectionManager` becomes `MeshHighlightState`, and the
appearance, overlay, resolver and renderer types take a `Highlight` prefix.
Selection state and the `PeerSelection*`/`PeerHover*` layer are unchanged.
