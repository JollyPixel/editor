---
"@jolly-pixel/engine": major
"@jolly-pixel/runtime": major
---

`SceneManager` loads `scene.assets` through `world.assetCoordinator`; `SceneLoader`, `SceneLoadDriver` and `setSceneLoader()` are removed, and `SceneLoad.done` settles with the load. The engine exports `createDefaultAssetLoaders()`.
`RuntimeMetrics` owns renderer latching and the readout panel (`mountPanel()`, `dispose()`); `recorder`, `revision` and `attachPanel()` are removed, use `runtime.stats`.
