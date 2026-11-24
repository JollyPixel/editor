# @jolly-pixel/asset

## 5.0.0

### Major Changes

- [#1234](https://github.com/JollyPixel/editor/pull/1234) [`ec79d3f`](https://github.com/JollyPixel/editor/commit/ec79d3f32c41f9c43ea81271e805fe48416e1d6a) Thanks [@fraxken](https://github.com/fraxken)! - Remove `AssetLoadContext.signal` and the `options` of `AssetCoordinator.load`. Add `AssetLoaderRegistry.find(type)` and `AssetPath.value`.

### Minor Changes

- [#1214](https://github.com/JollyPixel/editor/pull/1214) [`5b2019f`](https://github.com/JollyPixel/editor/commit/5b2019f7ae2624255c6c2ac3ea510fe817005ac0) Thanks [@fraxken](https://github.com/fraxken)! - Loaders can load the assets they depend on through `AssetLoadContext.assets`. Add `AssetPath.resolve()` and `AssetCatalog.findByPath()`.

- [#1178](https://github.com/JollyPixel/editor/pull/1178) [`5494a67`](https://github.com/JollyPixel/editor/commit/5494a67d7495071378b5eae430d51ef034cb5c35) Thanks [@fraxken](https://github.com/fraxken)! - Extensions can declare read-only `queries`, such as `CatalogClient.read(assetId)`. Kind resolution picks the longest matching extension.

- [#1225](https://github.com/JollyPixel/editor/pull/1225) [`b8d702d`](https://github.com/JollyPixel/editor/commit/b8d702d7da9e919b194ad25bdbca76aa86c95311) Thanks [@fraxken](https://github.com/fraxken)! - A scene skips, with a warning, a component whose asset is missing instead of failing to load. `Runtime.create` takes `worldLogger`.

### Patch Changes

- [#1225](https://github.com/JollyPixel/editor/pull/1225) [`b7d2f82`](https://github.com/JollyPixel/editor/commit/b7d2f8249cb29ac71e78cb7e92730a2d818d567f) Thanks [@fraxken](https://github.com/fraxken)! - `AssetPath.resolve()` reads a `\` in a specifier as `/`, and keeps a `%` that starts no valid escape, such as `50% off.png`, instead of throwing `URIError`.

## 4.0.0

### Major Changes

- [#1071](https://github.com/JollyPixel/editor/pull/1071) [`32d05ac`](https://github.com/JollyPixel/editor/commit/32d05acf969fc7b09067ffcda2fcea0e6191fbcd) Thanks [@fraxken](https://github.com/fraxken)! - Add `AssetKind` and `AssetPath`, which replace `AssetSource`; asset records carry `path` instead of `source`.

- [#1024](https://github.com/JollyPixel/editor/pull/1024) [`9123c45`](https://github.com/JollyPixel/editor/commit/9123c4578d791cb8f9d3749e56d2c8268ee87ec7) Thanks [@fraxken](https://github.com/fraxken)! - Rename methods named `xOf`, `xFor` or `getX`/`setX` after what they do (for example `inverseOf` → `invert`, `UVRegion.rectFor` → `slotRect`, `MessageParser.of` → `fromProtocol`).
  The package docs list the new names; behavior is unchanged.

### Minor Changes

- [#1018](https://github.com/JollyPixel/editor/pull/1018) [`c9726dc`](https://github.com/JollyPixel/editor/commit/c9726dc516927b5d119e066e7dfa0a1bca536eaf) Thanks [@fraxken](https://github.com/fraxken)! - Model loaders and the KTX2 loader load on first use. Catalog types validate with `zod/mini`, so malformed shapes throw `$ZodError`.

- [#977](https://github.com/JollyPixel/editor/pull/977) [`6b9daee`](https://github.com/JollyPixel/editor/commit/6b9daee5304c6bf06fd77086633e682d35640afc) Thanks [@fraxken](https://github.com/fraxken)! - Open an asset at a tag, read-only, through tag rooms (`kind@tag:assetId`). `RightsGate.configured` becomes `gated`.

## 3.0.0

### Major Changes

- [#796](https://github.com/JollyPixel/editor/pull/796) [`0db872e`](https://github.com/JollyPixel/editor/commit/0db872e6e3567a4a0deca4ad6bda0b30d3b643c9) Thanks [@fraxken](https://github.com/fraxken)! - `AssetCatalog` gains `find()` and `set()` and drops `replace()`, `firstOfKind()` and the fetch helpers. `AssetStore` is internal: use `AssetCoordinator.evict()`.

### Patch Changes

- [#789](https://github.com/JollyPixel/editor/pull/789) [`b520e7e`](https://github.com/JollyPixel/editor/commit/b520e7e37c000763a492f68635af528ca461a285) Thanks [@fraxken](https://github.com/fraxken)! - Package subpaths follow one naming scheme (`/node`, `/client`, `/browser`), and every package declares `exports`; for example, import `event-store/node` instead of `event-store/sqlite`. Package roots are browser-safe.

## 2.1.0

### Minor Changes

- [#725](https://github.com/JollyPixel/editor/pull/725) [`9e4b7a1`](https://github.com/JollyPixel/editor/commit/9e4b7a16d5348458027d06eafc68baf51ca4f519) Thanks [@fraxken](https://github.com/fraxken)! - Track dependencies between assets in the catalog. Tilesets can point at a pixel-art `asset`, and several `PixelArtCanvas` can share one headless `PixelDocument`.

## 2.0.0

### Major Changes

- [#689](https://github.com/JollyPixel/editor/pull/689) [`81f9fcc`](https://github.com/JollyPixel/editor/commit/81f9fcc003a62bb102e5f0cfb4cf439165778ccf) Thanks [@fraxken](https://github.com/fraxken)! - Tilesets are declared on the world (`engine.tilesets`), and `VoxelEngine` emits one `"command"` event that replaces the per-change callbacks. Add the browser `CatalogClient`.

## 1.1.0

### Minor Changes

- [#491](https://github.com/JollyPixel/editor/pull/491) [`18842ab`](https://github.com/JollyPixel/editor/commit/18842abe5ad347f63eacf8254d0685cba235adee) Thanks [@fraxken](https://github.com/fraxken)! - Allow AssetRecord id to be either string or AssetId and align it under the hood using static method AssetId.from

- [#557](https://github.com/JollyPixel/editor/pull/557) [`c5e4f38`](https://github.com/JollyPixel/editor/commit/c5e4f38bafbc56cfba7a5de5d5f66e3ed1cf6f65) Thanks [@fraxken](https://github.com/fraxken)! - Catalogs and records can be read from their own URL (`AssetCatalog.fetch()`, `AssetRecord.fetch()`), with kind lookups through `byKind()`.
