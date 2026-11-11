---
"@jolly-pixel/asset": minor
"@jolly-pixel/engine": minor
"@jolly-pixel/runtime": minor
---

A `FileScene` skips, with a warning, a component whose asset is missing, of another kind or without a loader (`AssetCoordinator.canLoad`, `Scene.assetsToLoad`) instead of failing the scene load.
`LoggerOptions` takes a `listener` of unformatted entries; `Runtime.create` takes `worldLogger`, the `LoggerOptions` of `world.logger`.
