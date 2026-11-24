# @jolly-pixel/asset-source

## 4.0.1

### Patch Changes

- Updated dependencies [[`ec79d3f`](https://github.com/JollyPixel/editor/commit/ec79d3f32c41f9c43ea81271e805fe48416e1d6a), [`5b2019f`](https://github.com/JollyPixel/editor/commit/5b2019f7ae2624255c6c2ac3ea510fe817005ac0), [`b7d2f82`](https://github.com/JollyPixel/editor/commit/b7d2f8249cb29ac71e78cb7e92730a2d818d567f), [`5494a67`](https://github.com/JollyPixel/editor/commit/5494a67d7495071378b5eae430d51ef034cb5c35), [`b8d702d`](https://github.com/JollyPixel/editor/commit/b8d702d7da9e919b194ad25bdbca76aa86c95311)]:
  - @jolly-pixel/asset@5.0.0

## 4.0.0

### Major Changes

- [#859](https://github.com/JollyPixel/editor/pull/859) [`425cef9`](https://github.com/JollyPixel/editor/commit/425cef984d0c6e5bf06f99fa29e0282acb47350b) Thanks [@fraxken](https://github.com/fraxken)! - Empty folders now persist: `AssetSource` and `CatalogClient` can list, create, move and delete folders. `watch` callbacks also say whether a file or a folder changed.

- [#1076](https://github.com/JollyPixel/editor/pull/1076) [`8539d87`](https://github.com/JollyPixel/editor/commit/8539d8702d62c6b27ade0f1e0bb13134b20e90fe) Thanks [@fraxken](https://github.com/fraxken)! - Every source rejects a missing path with `AssetPathNotFoundError`, and `AssetSource.isIgnored` is required. Paths reaching an ignored folder through links are rejected.

- [#1080](https://github.com/JollyPixel/editor/pull/1080) [`59fc78a`](https://github.com/JollyPixel/editor/commit/59fc78a35178c8a5eee14462eb8b27ace71d1e22) Thanks [@fraxken](https://github.com/fraxken)! - IndexedDB storage always uses `globalThis.indexedDB` (the `factory` option is removed), and databases older than the `folders` store are no longer upgraded.

- [#1024](https://github.com/JollyPixel/editor/pull/1024) [`9123c45`](https://github.com/JollyPixel/editor/commit/9123c4578d791cb8f9d3749e56d2c8268ee87ec7) Thanks [@fraxken](https://github.com/fraxken)! - Rename methods named `xOf`, `xFor` or `getX`/`setX` after what they do (for example `inverseOf` → `invert`, `UVRegion.rectFor` → `slotRect`, `MessageParser.of` → `fromProtocol`).
  The package docs list the new names; behavior is unchanged.

### Minor Changes

- [#1078](https://github.com/JollyPixel/editor/pull/1078) [`89073fc`](https://github.com/JollyPixel/editor/commit/89073fcf9c2ca0fa9ff2f1b5c00746c95544e47e) Thanks [@fraxken](https://github.com/fraxken)! - Add `writableAssetPath(source, input)`, which normalizes a path and rejects it as `reserved` when it is a state path or one the source ignores.

- [#951](https://github.com/JollyPixel/editor/pull/951) [`86af3d5`](https://github.com/JollyPixel/editor/commit/86af3d5b5e2fcc0ca9db56460add568776bde5eb) Thanks [@fraxken](https://github.com/fraxken)! - Support KTX2 compressed textures: the `texture` kind claims `.ktx2`, and `Runtime` builds a loader from `assets.ktx2.transcoderPath`.

- [#869](https://github.com/JollyPixel/editor/pull/869) [`e646731`](https://github.com/JollyPixel/editor/commit/e646731d6968af9a58604f5b503950e73dfa9681) Thanks [@fraxken](https://github.com/fraxken)! - The event store adds `expectedVersion` appends and per-asset compaction, SQLite runs in WAL mode, and asset snapshots and reconciliation are faster and no longer drop commands.

### Patch Changes

- Updated dependencies [[`32d05ac`](https://github.com/JollyPixel/editor/commit/32d05acf969fc7b09067ffcda2fcea0e6191fbcd), [`c9726dc`](https://github.com/JollyPixel/editor/commit/c9726dc516927b5d119e066e7dfa0a1bca536eaf), [`9123c45`](https://github.com/JollyPixel/editor/commit/9123c4578d791cb8f9d3749e56d2c8268ee87ec7), [`6b9daee`](https://github.com/JollyPixel/editor/commit/6b9daee5304c6bf06fd77086633e682d35640afc)]:
  - @jolly-pixel/asset@4.0.0

## 3.0.0

### Major Changes

- [#781](https://github.com/JollyPixel/editor/pull/781) [`20c529d`](https://github.com/JollyPixel/editor/commit/20c529d199eb0e5a7430c99003872398a065604e) Thanks [@fraxken](https://github.com/fraxken)! - Asset and catalog handlers support ETags, `304` and byte ranges, and Windows-reserved path segments are refused everywhere.

- [#789](https://github.com/JollyPixel/editor/pull/789) [`b520e7e`](https://github.com/JollyPixel/editor/commit/b520e7e37c000763a492f68635af528ca461a285) Thanks [@fraxken](https://github.com/fraxken)! - Package subpaths follow one naming scheme (`/node`, `/client`, `/browser`), and every package declares `exports`; for example, import `event-store/node` instead of `event-store/sqlite`. Package roots are browser-safe.

### Patch Changes

- Updated dependencies [[`0db872e`](https://github.com/JollyPixel/editor/commit/0db872e6e3567a4a0deca4ad6bda0b30d3b643c9), [`b520e7e`](https://github.com/JollyPixel/editor/commit/b520e7e37c000763a492f68635af528ca461a285)]:
  - @jolly-pixel/asset@3.0.0

## 2.1.0

### Minor Changes

- [#727](https://github.com/JollyPixel/editor/pull/727) [`3f115d7`](https://github.com/JollyPixel/editor/commit/3f115d726114f00b281f74d42182fd37b3502d44) Thanks [@fraxken](https://github.com/fraxken)! - Asset kinds declare `extensions` instead of `match` + `contentTypes`; `textureAssetHandler` and `binaryAssetHandler` become `textureAssetKind` and `binaryAssetKind`.

- [#744](https://github.com/JollyPixel/editor/pull/744) [`711429b`](https://github.com/JollyPixel/editor/commit/711429bbf691c24a26f2b53d843e0eb63a098e41) Thanks [@fraxken](https://github.com/fraxken)! - Add `IndexedDbAssetSource`, a browser-persisted `AssetSource`, under the new `@jolly-pixel/asset-source/indexeddb` entry.

- [#743](https://github.com/JollyPixel/editor/pull/743) [`6321913`](https://github.com/JollyPixel/editor/commit/632191387a3708bbefaebfc8f59bf0c105c4f242) Thanks [@fraxken](https://github.com/fraxken)! - The asset backend can run inside a browser page through `LoopbackTransport`. Content hashing uses WebCrypto, so `writeData()` is async.

### Patch Changes

- [#745](https://github.com/JollyPixel/editor/pull/745) [`2c0dcdf`](https://github.com/JollyPixel/editor/commit/2c0dcdfdd4990c315ee873f9eb2eaabe34155dd1) Thanks [@fraxken](https://github.com/fraxken)! - Delegate `FilesystemAssetSource` atomic writes to `@openally/atomic-fs`, which flushes to disk and retries transient Windows errors.
  Only files named like atomic-fs temporary files are now hidden from `list()`.
- Updated dependencies [[`9e4b7a1`](https://github.com/JollyPixel/editor/commit/9e4b7a16d5348458027d06eafc68baf51ca4f519)]:
  - @jolly-pixel/asset@2.1.0

## 2.0.0

### Major Changes

- [#636](https://github.com/JollyPixel/editor/pull/636) [`f0363be`](https://github.com/JollyPixel/editor/commit/f0363bea0dafae6f2e899b491c6f4c6d4f777acb) Thanks [@fraxken](https://github.com/fraxken)! - Add native existence checks and atomic conditional writes to `AssetSource`.
  Use conditional writes when initializing workspace assets and state files.

### Minor Changes

- [#690](https://github.com/JollyPixel/editor/pull/690) [`619e2a7`](https://github.com/JollyPixel/editor/commit/619e2a7c5599efb41e77d039c8a112ef02eabcc2) Thanks [@fraxken](https://github.com/fraxken)! - Move `createAssetStaticHandler` and the content-type helpers to `@jolly-pixel/asset-source`; pass `registry.contentTypes()` as `contentTypes` instead of `kinds`.

### Patch Changes

- Updated dependencies [[`81f9fcc`](https://github.com/JollyPixel/editor/commit/81f9fcc003a62bb102e5f0cfb4cf439165778ccf)]:
  - @jolly-pixel/asset@2.0.0
