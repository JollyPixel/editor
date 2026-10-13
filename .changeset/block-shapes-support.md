---
"@jolly-pixel/three": minor
"@jolly-pixel/pixel-draw.renderer": minor
---

Add `HighlightMeshSilhouette` and the `"silhouette"` technique: box bars on a `BoxGeometry`, the camera-facing contour on any other mesh. Both silhouettes share the `HighlightSilhouette` base class.
UV regions with triangle or compound faces can now be resized, stacked ones included; `UVRegion.resizable` is removed.
