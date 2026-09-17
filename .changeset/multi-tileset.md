---
"@jolly-pixel/voxel.renderer": major
"@jolly-pixel/asset-server": major
"@jolly-pixel/asset": major
"@jolly-pixel/pixel-draw.renderer": minor
---

The engine declares a world's tilesets in `engine.tilesets` (`TilesetList`), saved with `defaultTileSize`; `TileRef.size`, tile rescale/rect helpers are added and `load()` warns instead of throwing for an unloaded tileset.
`VoxelEngine` and `VoxelWorld` are now emitters: one `"command"` event (`VoxelCommand` + `origin`) and `engine.apply()` replace `onLayerUpdated`/`onBlockUpdated`/`onTilesetUpdated`, `applyRemoteCommand()` and `applyTilesetEvent()`; `applyVoxelCommand()` applies commands headlessly.
Add the browser `CatalogClient` (`@jolly-pixel/asset-server/catalog/client`), `catalog:create` `onConflict: "suffix"` and seed entries with a fixed `AssetId`; add the `AssetSource` value object and `createPixelArtDocument()`; `AssetRoom` replaces `assetRoomName()`/`parseAssetRoomName()`.
