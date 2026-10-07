---
"@jolly-pixel/network": major
"@jolly-pixel/pixel-draw.renderer": major
"@jolly-pixel/voxel.renderer": major
---

`CommandDocument`, `ChangeReceipts` and `CommandHistory` move from `@jolly-pixel/network/client` to the new `@jolly-pixel/history` package.
`PixelArtCanvas` undo runs on a `CommandHistory` and refuses steps a peer overwrote; `PixelDocument` loses `history`, `undo()` and `redo()`.
`VoxelHistory` is removed: register `VoxelDocument.edits` with `voxelHistoryRegistration()` to undo voxel edits.
