---
"@jolly-pixel/network": major
"@jolly-pixel/pixel-draw.renderer": major
"@jolly-pixel/asset-server": major
---

Rename `CommandDocumentKind.createDocument(room)` to `syncDocument(room)` (now an alias of the new `DocumentKind`), `InvalidAssetDocumentError` to `InvalidAssetFileError` and `ProjectFile.document` to `ProjectFile.data`.
Rename the `.pixelart` codec to `PixelArtFile` (`create/parse/encode/decodePixelArtFile`, `InvalidPixelArtFileError`, `PIXEL_ART_FILE_VERSION`) and `DocumentCommand` to `PixelDocumentCommand`.
