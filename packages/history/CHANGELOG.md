# @jolly-pixel/history

## 3.0.0

### Major Changes

- [#1101](https://github.com/JollyPixel/editor/pull/1101) [`c1a8763`](https://github.com/JollyPixel/editor/commit/c1a87634da5e6c17e86fc3a1f9fcec587d9a5f64) Thanks [@fraxken](https://github.com/fraxken)! - Rename `KeyedSnapshot` to `KeyedCapture`, stop exporting `KeyedReads`, and rename `CommandDocument.apply` (and `SyncableDocument.apply`) to `applyRemote`.
  `CommandDocument`, `CommandHistory` and `ChangeReceipts` no longer extend `Emitter`: listen with `on`/`off`/`subscribe` (`subscribe` only on receipts); `emit` is private. `CommandChangeInit` is a union keyed by `origin`.

### Minor Changes

- [#1095](https://github.com/JollyPixel/editor/pull/1095) [`40d00c4`](https://github.com/JollyPixel/editor/commit/40d00c45ca7946f8205cc8cdb01ff043af5d0c16) Thanks [@fraxken](https://github.com/fraxken)! - Add scene files (`SceneFile`, `FileScene`, `SceneInstance`, scene transform helpers, `ComponentDefinitions`), `LightComponent`, `MeshRenderer`, `OrbitFlyCamera.frame()`, `Transform.visibleInHierarchy`, `inferScenePropertyType` and the `render` camera and `properties` behavior options to `engine`; `Actor.name` now follows `object3D.name`. Frames only visit actors with updating components and no longer allocate per actor or component; `sceneManager.actors.updating` lets a host sleep once nothing updates, and a component can start asleep with the `needUpdate` option.
  Breaking: `Camera.configure()` replaces the camera setters, `sceneManager.actors` (`ActorRegistry`) replaces its actor and component scheduling methods, and `renderStrategy`, `markRenderOrderDirty()` and the `Behavior` property mirror (`getProperty`, `setProperty`, `mergeProperties`, `BehaviorProperties`) are removed.
  Add `CameraGizmo` and `LightGizmo` to `three`, refusal messages to `history` and `reconcilePeerMarks` to `ui/network`.

## 2.0.0

### Major Changes

- [#1009](https://github.com/JollyPixel/editor/pull/1009) [`5af5621`](https://github.com/JollyPixel/editor/commit/5af5621e4223fb97ab38b22530a64c0884d52051) Thanks [@fraxken](https://github.com/fraxken)! - `ChangeReceipts.discard()`, its `discarded` event and the `dropped` refusal reason are removed: the network sync client no longer drops pending edits.

- [#1024](https://github.com/JollyPixel/editor/pull/1024) [`9123c45`](https://github.com/JollyPixel/editor/commit/9123c4578d791cb8f9d3749e56d2c8268ee87ec7) Thanks [@fraxken](https://github.com/fraxken)! - Rename methods named `xOf`, `xFor` or `getX`/`setX` after what they do (for example `inverseOf` → `invert`, `UVRegion.rectFor` → `slotRect`, `MessageParser.of` → `fromProtocol`).
  The package docs list the new names; behavior is unchanged.

### Minor Changes

- [#939](https://github.com/JollyPixel/editor/pull/939) [`a23ea74`](https://github.com/JollyPixel/editor/commit/a23ea74dca38f8684e890f0abed659277ccc230e) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - `CommandHistory` loses its `scopes` option: a scope starts with its first step and `removeScope()` drops it; `EMPTY_HISTORY_STATE` is exported and `HistoryScopeState.refused` is now readonly.
  `@jolly-pixel/ui/network` exports `presencePeerOf(peer)`, plus `markedPeers()` and `peerMarks()` to build a `PeerMarkMap` from presence values that carry more than a key.
