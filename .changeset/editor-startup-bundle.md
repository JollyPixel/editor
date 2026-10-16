---
"@jolly-pixel/asset": minor
"@jolly-pixel/engine": patch
"@jolly-pixel/runtime": patch
"@jolly-pixel/three": patch
---

The model asset loader and `Runtime` import the three.js model loaders, meshopt decoder and `KTX2Loader` on first use; `BakedRoomEnvironment.load()` starts its request one microtask after the call.
`AssetCatalog`, `AssetRecord` and `AssetReference` validate with `zod/mini`, so a malformed shape throws `$ZodError` instead of the classic `ZodError`.
