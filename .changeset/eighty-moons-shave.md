---
"@jolly-pixel/pixel-draw.renderer": minor
"@jolly-pixel/voxel.renderer": minor
"@jolly-pixel/editor.pixel-art": patch
---

Add `decodePng` and `createPixelArtBufferFromPng`, a single environment-agnostic
PNG path shared by the Node seed pipeline and by browsers without `ImageDecoder`,
where texture imports previously went through a premultiplying canvas.
Also add `resolveTilesetDefinition`, so a seeded document and a loaded texture
derive the same tile grid.
