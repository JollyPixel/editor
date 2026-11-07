---
"@jolly-pixel/pixel-draw.renderer": major
---

`PixelCommand`'s `texture-replaced` carries its pixels as a `Uint8Array` instead of base64; `toPixelCommand` and `toPixelDocumentCommand` copy the bytes.
