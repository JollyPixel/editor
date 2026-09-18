# @jolly-pixel/asset-source

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
