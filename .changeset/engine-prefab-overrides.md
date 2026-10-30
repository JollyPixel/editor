---
"@jolly-pixel/engine": minor
---

Add prefab overrides: a `SceneActorFile` with `prefab` can carry `overrides` for the names, visibility, transforms, component data and asset slots of the actors it expands.
`SceneInstance` gains `override()`, `expandedActors()`, `expandedActor()`, `expandedComponent()` and `prefabSceneIds()`; `InstancePath` reads and builds path ids.
