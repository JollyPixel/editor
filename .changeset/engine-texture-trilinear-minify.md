---
"@jolly-pixel/engine": patch
---

`TextureAssetLoader` minifies textures that have mipmaps trilinearly, so distant textures stop sparkling. `filter` now sets magnification only.
