---
"@jolly-pixel/three": minor
---

Add the `boxSilhouette` highlight technique, exported as `HighlightBoxSilhouette`: a camera-facing outline for box meshes, built from watertight edge geometry instead of an outline pass.
`MeshHighlightAppearance` gains `occludedOpacityScale` to dim any indicator's portion hidden behind other geometry, and overlay factories can read `peer` to render a local indicator above a peer one on the same geometry.
