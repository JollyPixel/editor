---
"@jolly-pixel/voxel.renderer": major
---

`defineFace()` replaces `projectedFace()` and resolves both `uvs` and `cull`,
so `FaceDefinition` has no optional member left, and `BlockShapeBase` derives
`occludes()` from the shape's own geometry. `shapeFaceRange()` is gone; each
range now carries the `definitions` it was built from.
