---
"@jolly-pixel/three": patch
---

Cut per-frame GPU and CPU cost of highlights and gizmos: lighter `HighlightPass` and `HighlightPassJfa` passes, highlight masks that draw only their entries, cached silhouette contours and bounds, shared `GizmoIcon` glyph textures, culled `AreaBox` edges and a cheaper `Grid` shader.
A filled `HighlightBoundingBox` no longer grows a little on every update.
