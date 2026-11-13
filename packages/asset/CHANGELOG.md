# @jolly-pixel/asset

## 5.0.0

### Major Changes

- [#1234](https://github.com/JollyPixel/editor/pull/1234) [`ec79d3f`](https://github.com/JollyPixel/editor/commit/ec79d3f32c41f9c43ea81271e805fe48416e1d6a) Thanks [@fraxken](https://github.com/fraxken)! - Remove `AssetLoadContext.signal` and the `options` of `AssetCoordinator.load`: shared loads ignored every caller signal but the first. The coordinator now rejects a foreign `AssetType` token as soon as its kind has a loader, and a throwing `onProgress` is reported as uncaught instead of failing the batch.
  Add `AssetLoaderRegistry.find(type)` and `AssetPath.value`.

### Minor Changes

- [#1214](https://github.com/JollyPixel/editor/pull/1214) [`5b2019f`](https://github.com/JollyPixel/editor/commit/5b2019f7ae2624255c6c2ac3ea510fe817005ac0) Thanks [@fraxken](https://github.com/fraxken)! - A loader's `AssetLoadContext` now carries `assets`, which loads the assets its value depends on into the same coordinator and exposes the catalog.
  Add `AssetPath.resolve(specifier)`, which resolves a relative specifier like a URL, and `AssetCatalog.findByPath(path)`.

- [#1178](https://github.com/JollyPixel/editor/pull/1178) [`5494a67`](https://github.com/JollyPixel/editor/commit/5494a67d7495071378b5eae430d51ef034cb5c35) Thanks [@fraxken](https://github.com/fraxken)! - Extensions can declare `queries`, events a member with `read` rights may still send. The catalog adds `CatalogClient.read(assetId)` as such a query.
  Kind resolution picks the longest matching extension (`AssetPath.matchExtension`), and reconciliation re-creates a `binary` asset once a registered kind claims its path.

- [#1225](https://github.com/JollyPixel/editor/pull/1225) [`b8d702d`](https://github.com/JollyPixel/editor/commit/b8d702d7da9e919b194ad25bdbca76aa86c95311) Thanks [@fraxken](https://github.com/fraxken)! - A `FileScene` skips, with a warning, a component whose asset is missing, of another kind or without a loader (`AssetCoordinator.canLoad`, `Scene.assetsToLoad`) instead of failing the scene load.
  `LoggerOptions` takes a `listener` of unformatted entries; `Runtime.create` takes `worldLogger`, the `LoggerOptions` of `world.logger`.

### Patch Changes

- [#1225](https://github.com/JollyPixel/editor/pull/1225) [`b7d2f82`](https://github.com/JollyPixel/editor/commit/b7d2f8249cb29ac71e78cb7e92730a2d818d567f) Thanks [@fraxken](https://github.com/fraxken)! - `AssetPath.resolve()` reads a `\` in a specifier as `/`, and keeps a `%` that starts no valid escape, such as `50% off.png`, instead of throwing `URIError`.

## 4.0.0

### Major Changes

- [#1071](https://github.com/JollyPixel/editor/pull/1071) [`32d05ac`](https://github.com/JollyPixel/editor/commit/32d05acf969fc7b09067ffcda2fcea0e6191fbcd) Thanks [@fraxken](https://github.com/fraxken)! - Add `AssetKind` and `AssetPath` (replaces `AssetSource`). Records carry `path` instead of `source` in `AssetRecord`, `AssetRecordData` and the catalog protocol, and a kind may no longer contain `@`.
  `AssetReference.equals` compares `AssetType` tokens, `AssetCoordinator.catalog`/`loaders` are private, and `evict()` takes a reference and returns its typed value.

- [#1024](https://github.com/JollyPixel/editor/pull/1024) [`9123c45`](https://github.com/JollyPixel/editor/commit/9123c4578d791cb8f9d3749e56d2c8268ee87ec7) Thanks [@fraxken](https://github.com/fraxken)! - Rename methods named `xOf`, `xFor` or `getX`/`setX` after what they do (for example `inverseOf` → `invert`, `UVRegion.rectFor` → `slotRect`, `MessageParser.of` → `fromProtocol`).
  The package docs list the new names; behavior is unchanged.

### Minor Changes

- [#1018](https://github.com/JollyPixel/editor/pull/1018) [`c9726dc`](https://github.com/JollyPixel/editor/commit/c9726dc516927b5d119e066e7dfa0a1bca536eaf) Thanks [@fraxken](https://github.com/fraxken)! - The model asset loader and `Runtime` import the three.js model loaders, meshopt decoder and `KTX2Loader` on first use; `BakedRoomEnvironment.load()` starts its request one microtask after the call.
  `AssetCatalog`, `AssetRecord` and `AssetReference` validate with `zod/mini`, so a malformed shape throws `$ZodError` instead of the classic `ZodError`.

- [#977](https://github.com/JollyPixel/editor/pull/977) [`6b9daee`](https://github.com/JollyPixel/editor/commit/6b9daee5304c6bf06fd77086633e682d35640afc) Thanks [@fraxken](https://github.com/fraxken)! - Tag rooms: `AssetRoom` takes an optional `tag` (`kind@tag:assetId`), and the asset-server resolves such a room read-only with the tagged content through `AssetTags.read()`.
  Network `RoomResolution.readOnly` caps every message right of a resolved room at `read`, and `RightsGate.configured` becomes `gated`; `TagName` (with `isRestorePoint`) and `InvalidTagNameError` are exported from `@jolly-pixel/asset-server/client`.

## 3.0.0

### Major Changes

- [#796](https://github.com/JollyPixel/editor/pull/796) [`0db872e`](https://github.com/JollyPixel/editor/commit/0db872e6e3567a4a0deca4ad6bda0b30d3b643c9) Thanks [@fraxken](https://github.com/fraxken)! - `AssetCatalog` gains `find()` and `set()`; `replace()`, `firstOfKind()`, the `fetch`/`text`/`sourceUrl` helpers, `assetSourceUrl`, `AssetKindNotFoundError` and `AssetFetchError` are removed. `parse()` methods validate with zod and throw `ZodError`, and kinds reject a colon everywhere.
  `AssetStore` is internal: `AssetCoordinator.evict()` replaces `coordinator.store`, requests no longer create entries, and `loadBatch()` accepts `signal`. `LAUNCH_ELEMENT_ID` moves to `@jolly-pixel/asset-server`.

### Patch Changes

- [#789](https://github.com/JollyPixel/editor/pull/789) [`b520e7e`](https://github.com/JollyPixel/editor/commit/b520e7e37c000763a492f68635af528ca461a285) Thanks [@fraxken](https://github.com/fraxken)! - Subpaths follow one naming scheme: `network/node` (now with the Vite plugin), `asset-server/{client,node}`, `asset-source/node`, `event-store/node` (was `./sqlite`), `image/browser` and `voxel.renderer/engine` (the Rapier plugin joins the root). `.ts` keys, wildcards, `network/parser` and `network/transport/*` are removed; transports ship from the network root, `./client` and `./node`.
  The `asset-server` and `asset-source` roots are now browser-safe and absorb `./backend`, `./kinds`, `./core` and `./indexeddb`; Node-only code moves to `./node`.
  Every published package declares `exports` instead of `main`/`types`, and the packages with no import-time side effects declare `"sideEffects": false`.

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
