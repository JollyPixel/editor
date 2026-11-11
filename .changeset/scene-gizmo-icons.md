---
"@jolly-pixel/three": major
---

`CameraGizmo` and `LightGizmo` draw flat screen-sized icons, our own frustum (with an orthographic box and an up marker) and light shapes shown only while `selected`; the `"silhouette"` technique outlines groups through the new `HighlightGroupSilhouette`.
Breaking: `LightGizmo` takes `selectedColor` instead of `color`, `CameraGizmo`'s `color` is now the idle line color beside a new `selectedColor`, and silhouette `linewidth`/`innerThickness` are now world units on scaled targets.
