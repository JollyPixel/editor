---
"@jolly-pixel/image": patch
---

`decodeRaster()` and `decodeRasterCanvas()` keep the WebCodecs frame open until its copy finishes and now require `createImageBitmap()`.
`decodePng()` rejects truncated image data with `InvalidPngError` and decodes faster.
