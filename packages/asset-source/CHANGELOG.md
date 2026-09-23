# @jolly-pixel/asset-source

## 2.1.0

### Minor Changes

- [#727](https://github.com/JollyPixel/editor/pull/727) [`3f115d7`](https://github.com/JollyPixel/editor/commit/3f115d726114f00b281f74d42182fd37b3502d44) Thanks [@fraxken](https://github.com/fraxken)! - `AssetKindHandler` replaces `match` + `contentTypes` with required `extensions` (extension to content type, multi-dot allowed); `match` now only narrows the claim.
  `textureAssetHandler`/`binaryAssetHandler` are renamed `textureAssetKind`/`binaryAssetKind`, and `resolveContentType` picks the longest matching extension.

- [#744](https://github.com/JollyPixel/editor/pull/744) [`711429b`](https://github.com/JollyPixel/editor/commit/711429bbf691c24a26f2b53d843e0eb63a098e41) Thanks [@fraxken](https://github.com/fraxken)! - Add `IndexedDbAssetSource`, a browser-persisted `AssetSource`, under the new `@jolly-pixel/asset-source/indexeddb` entry.

- [#743](https://github.com/JollyPixel/editor/pull/743) [`6321913`](https://github.com/JollyPixel/editor/commit/632191387a3708bbefaebfc8f59bf0c105c4f242) Thanks [@fraxken](https://github.com/fraxken)! - The asset back-end can run inside a browser page: `LoopbackTransport` and `ClientOptions.socket` connect a `Client` to an in-process `Server`.
  New Node-free entries `@jolly-pixel/asset-source/core` and `@jolly-pixel/asset-server/backend`.
  Content hashes use WebCrypto: `writeData()` is async and `AssetWriter` applies writes one at a time, in call order.

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

- [#690](https://github.com/JollyPixel/editor/pull/690) [`619e2a7`](https://github.com/JollyPixel/editor/commit/619e2a7c5599efb41e77d039c8a112ef02eabcc2) Thanks [@fraxken](https://github.com/fraxken)! - Move `createAssetStaticHandler` and the content-type helpers to `@jolly-pixel/asset-source`.
  The handler drops its `kinds` option; pass `registry.contentTypes()` as `contentTypes` instead.
  `contentTypesFromKinds`, `DEFAULT_ASSET_PREFIX` and `AssetStaticPluginOptions` are removed (use `AssetKindRegistry.contentTypes()`, `ASSET_URL_PREFIX` and `AssetStaticHandlerOptions`).

### Patch Changes

- Updated dependencies [[`81f9fcc`](https://github.com/JollyPixel/editor/commit/81f9fcc003a62bb102e5f0cfb4cf439165778ccf)]:
  - @jolly-pixel/asset@2.0.0
