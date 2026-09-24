---
"@jolly-pixel/three": minor
---

`TransformControls` gains a `slab` axis handle kind: a square tip, half as deep as it is wide by default, for resize-style handles that should read differently from the scale cube.

`MeshHighlightAppearance` gains `renderOrder` and `xrayDepthWrite`. The box silhouette uses them to place its overlays in the render order, with peer indicators one step below, and to keep writing depth under xray so later transparent passes, such as a grid, stay hidden behind the outline. Its occluded pass never writes depth.

Fix `HighlightBoxSilhouette` throwing on a color change after the camera sat inside the box, which kept a late-joining peer from seeing existing selections.
