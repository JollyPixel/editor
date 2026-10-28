---
"@jolly-pixel/engine": major
---

Add `FileScene.capture()`, `captureSceneActors()`, `ComponentDefinition.owns`/`capture` and `ComponentDefinitions.create`/`apply`/`capture` to save a running scene as a `SceneFile`, the `Actor` scene property type, persistent actors, `Actor.active`, `ActorComponent.schedule()` on `world.timers`, `sceneManager.actors.find(persistentId)` and the `persistentId` actor option.
Add `hasComponent`, `ensureComponent`, `removeComponent`, `findComponentInChildren`, `findComponentInParent`, `root` and `hasDescendant` to `Actor`. Breaking: `IntegerIncrement.incr()` is renamed `next()`, `Actor.persistentId` is read-only, and a scene file actor takes its file id as `persistentId`.
Fix `Transform.moveForward`/`moveRight`/`moveUp` doubling the position, and add `Viewport`, `CanvasDimensions`, `CameraProjection`, `ActorComponents`, `SpriteSheet`, `UILayout` and `AudioPlaylists`. Breaking: `prepareRender(canvas)`, `camera.settings` replaces the camera getters, `actor.components` is an `ActorComponents`, `status`/`pendingForDestruction` replace `isDestroyed()`, ids are counted per world, and `actor.behaviors`, `componentsRequiringUpdate`, `PersistentIdIncrement` and the `Transform` static scratch objects are removed.
