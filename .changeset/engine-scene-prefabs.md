---
"@jolly-pixel/engine": minor
---

Expand scene file prefab instances: `SceneInstance` builds the referenced scene under each actor with `prefab`, using path ids, skips cycles and re-expands on `refresh(sceneId)`.
Add `ScenePrefabs`, `NO_SCENE_PREFABS`, `includedSceneFiles()` and the `prefabs` and `sceneId` options of `FileScene` and `SceneInstance`; a capture saves instances as their expanded actors.
