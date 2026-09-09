---
"@jolly-pixel/pixel-draw.renderer": major
---

Split `src/asset` into `src/serialization` (document format, codec, buffer
mapping) and `src/asset` (asset-server handler, extension, `PixelArtState`).
The codec now ships from the package root, so reading a `.pixelart` document
no longer pulls `@jolly-pixel/asset-server` into the graph.
