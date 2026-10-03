---
"@jolly-pixel/voxel.renderer": minor
---

Light tilesets with a tangent-space normal atlas: `loadTileset(def, texture, { normal })`, `TilesetAtlas.normal`, `updateNormal()`, `dispose()` and `disposeReplacedBy()`, and a derivative-frame `normalNode` on chunk materials that fades out with distance.
`MaterialGroup.normalScale` (default `1`, `0` turns the relief off) sets the strength per material group.
