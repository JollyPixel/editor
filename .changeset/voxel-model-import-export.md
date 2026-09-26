---
"@jolly-pixel/asset-server": patch
"@jolly-pixel/pixel-draw.renderer": minor
---

`exportAssetArchive` loads each document through its kind and rejects with `unreadable-asset` instead of producing an archive that import refuses.
Add `PixelDocument.disownUvRegions()` so another document can own UV regions, and an optional `UVMap.clear()` filter; `UVCompound.parts` is now mutable.
Export the UV geometry helpers `rectOf()`, `triangleCornerOf()` and `withRotation()`.
