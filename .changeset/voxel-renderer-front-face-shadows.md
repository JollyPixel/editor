---
"@jolly-pixel/voxel.renderer": patch
---

Chunk materials cast shadows from the faces they show (`shadowSide` follows `side`), so filtered shadows no longer leak light into inner corners.
Lights may need a `shadow.normalBias` of one to two shadow-map texels to keep lit faces free of acne.
