---
"@jolly-pixel/voxel.renderer": minor
---

Add block light: a material group `lightLevel` (0-15) lights nearby blocks in its emissive hue, scaled by `lighting.blockLight`, with a `wide` or `focused` falloff and an optional `shadowFill`.
Emission now multiplies the block texture instead of painting a flat colour; `MaterialGroup.glows` tells whether a group feeds bloom.
The transparency pass skips its transparent draws when the scene has no transparent material.
