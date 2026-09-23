# @jolly-pixel/asset

## 2.1.0

### Minor Changes

- [#725](https://github.com/JollyPixel/editor/pull/725) [`9e4b7a1`](https://github.com/JollyPixel/editor/commit/9e4b7a16d5348458027d06eafc68baf51ca4f519) Thanks [@fraxken](https://github.com/fraxken)! - Track asset dependency edges: `AssetKindHandler.dependencies`, a `dependencies` field on write events, a live catalog edge index with boot backfill, and a Vite `launch` option.
  `TilesetDefinition.src` is now optional; an asset-backed tileset names its pixels with `asset` instead.
  `PixelDocument` now owns edits, history replay and remote sync, so it runs headless and several `PixelArtCanvas` can share one through the new `document` option.

## 2.0.0

### Major Changes

- [#689](https://github.com/JollyPixel/editor/pull/689) [`81f9fcc`](https://github.com/JollyPixel/editor/commit/81f9fcc003a62bb102e5f0cfb4cf439165778ccf) Thanks [@fraxken](https://github.com/fraxken)! - The engine declares a world's tilesets in `engine.tilesets` (`TilesetList`), saved with `defaultTileSize`; `TileRef.size`, tile rescale/rect helpers are added and `load()` warns instead of throwing for an unloaded tileset.
  `VoxelEngine` and `VoxelWorld` are now emitters: one `"command"` event (`VoxelCommand` + `origin`) and `engine.apply()` replace `onLayerUpdated`/`onBlockUpdated`/`onTilesetUpdated`, `applyRemoteCommand()` and `applyTilesetEvent()`; `applyVoxelCommand()` applies commands headlessly.
  Add the browser `CatalogClient` (`@jolly-pixel/asset-server/catalog/client`), `catalog:create` `onConflict: "suffix"` and seed entries with a fixed `AssetId`; add the `AssetSource` value object and `createPixelArtDocument()`; `AssetRoom` replaces `assetRoomName()`/`parseAssetRoomName()`.

## 1.1.0

### Minor Changes

- [#491](https://github.com/JollyPixel/editor/pull/491) [`18842ab`](https://github.com/JollyPixel/editor/commit/18842abe5ad347f63eacf8254d0685cba235adee) Thanks [@fraxken](https://github.com/fraxken)! - Allow AssetRecord id to be either string or AssetId and align it under the hood using static method AssetId.from

- [#557](https://github.com/JollyPixel/editor/pull/557) [`c5e4f38`](https://github.com/JollyPixel/editor/commit/c5e4f38bafbc56cfba7a5de5d5f66e3ed1cf6f65) Thanks [@fraxken](https://github.com/fraxken)! - Add `AssetCatalog.fetch()` and `AssetRecord.sourceUrl()`/`fetch()`/`text()` so a
  catalog and a record can be read from their own URL, plus
  `AssetCatalog.byKind()`/`firstOfKind()` for kind lookups. Failed requests throw
  `AssetFetchError`, an empty kind lookup `AssetKindNotFoundError`.
