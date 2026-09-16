---
"@jolly-pixel/pixel-draw.renderer": patch
---

`centerTexture()` anchors a texture larger than the viewport to its top-left corner, one axis at a time, instead of centering it.
Resizing keeps that anchor on overflowing axes instead of shifting the camera by half the size change.
