---
"@jolly-pixel/engine": minor
---

Add `SceneManager.loadSceneAsset(ref)`, which loads the scene the game's `sceneSource` returns for an asset ID or path, and `Scene.prepare()`, which a load awaits before the scene's assets.
`FileScene` accepts a file loader and declares its assets through `assetsToLoad` only: its `assets` are now empty.
