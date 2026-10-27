---
"@jolly-pixel/engine": major
"@jolly-pixel/three": minor
"@jolly-pixel/history": minor
"@jolly-pixel/ui": minor
---

Add scene files (`SceneFile`, `FileScene`, `SceneInstance`, scene transform helpers, `ComponentDefinitions`), `LightComponent`, `MeshRenderer`, `OrbitFlyCamera.frame()`, `Transform.visibleInHierarchy`, `inferScenePropertyType` and the `render` camera and `properties` behavior options to `engine`; `Actor.name` now follows `object3D.name`.
Breaking: `Camera.configure()` replaces the camera setters, `sceneManager.actors` (`ActorRegistry`) replaces its actor and component scheduling methods, and `renderStrategy`, `markRenderOrderDirty()` and the `Behavior` property mirror (`getProperty`, `setProperty`, `mergeProperties`, `BehaviorProperties`) are removed.
Add `CameraGizmo` and `LightGizmo` to `three`, refusal messages to `history` and `reconcilePeerMarks` to `ui/network`.
