---
"@jolly-pixel/voxel.renderer": major
---

Rename `BlockDefinition.cullSelfFaces` to `cullCoveredFaces`, now `false` by
default for mask and blend blocks. When `false`, a double-sided block also
keeps the faces an opaque neighbour covers.
