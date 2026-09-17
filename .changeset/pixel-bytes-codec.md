---
"@jolly-pixel/pixel-draw.renderer": minor
---

Export `encodePixelBytes` and `decodePixelBytes`, the base64 codec used for a
document's `pixels` field, so consumers reading or writing that field no longer
need their own base64 dependency.
