---
"@jolly-pixel/three": patch
---

Fix `SelectionHighlight`'s `xray` mode rendering a broken, camera-angle-correlated fade instead of a smooth per-pixel one on low-poly meshes (a box, a cone) - the extruded hull geometry never had a `normal` attribute, so its Fresnel opacity fade silently fell back to a hardcoded constant normal.
