---
"@jolly-pixel/network": major
"@jolly-pixel/pixel-draw.renderer": major
"@jolly-pixel/voxel.renderer": major
---

`CommandDocument`, `ChangeReceipts` and `CommandHistory` move from `@jolly-pixel/network/client` to the new `@jolly-pixel/history` package.
`PixelArtCanvas` undo runs on a `PixelArtCanvasHistory` the host passes in; `PixelDocument` loses `history`, `undo()` and `redo()` and emits plain `EditChange`s.
`VoxelHistory` is removed and neither renderer depends on `@jolly-pixel/history`: undo wiring lives in the asset packages.
