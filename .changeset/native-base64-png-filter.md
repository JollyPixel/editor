---
"@jolly-pixel/image": minor
"@jolly-pixel/pixel-draw.renderer": patch
"@jolly-pixel/asset-server": patch
---

`encodePng` takes an optional `{ filter }`: `"adaptive"` (the default) or one fixed PNG row filter. `encodePngPixels` uses `"none"`: a 1024x512 tileset snapshot drops from about 165 KB to 95 KB.
pixel-draw.renderer and asset-server decode and encode base64 natively (`Uint8Array.fromBase64`, `Buffer`, then `atob`) and drop `js-base64`.
