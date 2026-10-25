---
"@jolly-pixel/pixel-draw.renderer": major
---

Save UV nets in the pixel document (`SavedUVNet`, `UVNetSet`, `saveUvNet`, `deleteUvNet`, `changeDefaultUvNet`, the `uv-net-*` commands and the `.pixelart` `uvNets` field) so they are saved with the texture and synced with peers.
`PixelDocument.loadSnapshot()` now takes one `PixelDocumentSnapshot` object instead of positional arguments.
