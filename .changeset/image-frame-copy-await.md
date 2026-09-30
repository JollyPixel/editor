---
"@jolly-pixel/image": patch
---

`decodeRaster()` and `decodeRasterCanvas()` now keep the WebCodecs frame open until its copy finishes, and fall back to the next decoder when that copy fails.
