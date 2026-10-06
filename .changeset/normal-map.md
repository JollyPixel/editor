---
"@jolly-pixel/pixel-draw.renderer": minor
"@jolly-pixel/voxel.renderer": minor
---

Add normal maps: pixel-draw derives an undoable, synced `NormalMap` per UV island (`NormalMapConfig`, `normal-map-*` commands) and can preview it through `PixelArtCanvas.textureView`.
Voxel-renderer lights blocksets with a tangent-space normal atlas (`loadBlockset(def, texture, { normal })`, `BlocksetAtlas.normal`), scaled per material group by `MaterialGroup.normalScale`.
