---
"@jolly-pixel/engine": minor
"@jolly-pixel/runtime": minor
"@jolly-pixel/asset-server": minor
"@jolly-pixel/asset-source": minor
"@jolly-pixel/voxel.renderer": minor
---

KTX2 textures: `TextureAssetLoader` and `createDefaultAssetLoaders` take a `ktx2` loader for `.ktx2` sources, and `Runtime` builds one from `assets.ktx2.transcoderPath`.
The `texture` asset kind claims `.ktx2`, served as `image/ktx2`; `loadBlocksets` accepts a `KTX2Loader`, and `AtlasTexture` includes `THREE.CompressedTexture`.
