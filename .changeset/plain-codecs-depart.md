---
"@jolly-pixel/pixel-draw.renderer": major
---

Remove `decodePng`, `InvalidPngError`, `DecodedPng` and `decodeRasterCanvas`
from the public API; they now live in `@jolly-pixel/image`. `decodeRasterBlob`
keeps its name and shape, and `encodeSelectionPng` output is now byte-exact
rather than round-tripped through a premultiplying canvas.
