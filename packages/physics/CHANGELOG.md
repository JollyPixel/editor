# @jolly-pixel/physics

## 2.0.0

### Major Changes

- [#1276](https://github.com/JollyPixel/editor/pull/1276) [`7d7aa9c`](https://github.com/JollyPixel/editor/commit/7d7aa9cedaf294a4fddfc03b166e575e8f3c9140) Thanks [@fraxken](https://github.com/fraxken)! - `SignalEvent.connect` returns a `SignalConnection`, takes `{ once }`, and `next()` awaits the following emit; `ActorComponent.listen` disconnects on destroy. Scene files wire signals to methods through component `connections`.
  `UISprite` signals are renamed to `pointerEntered`, `pointerExited`, `pointerPressed`, `pointerReleased`, `clicked`, `doubleClicked`, `rightClicked` (`onHover` removed), and `RigidBody.contacts` splits into `contactStarted` and `contactEnded`.

### Patch Changes

- [#1280](https://github.com/JollyPixel/editor/pull/1280) [`dc99a29`](https://github.com/JollyPixel/editor/commit/dc99a2924185d97da740f597eb3b79de323a566b) Thanks [@fraxken](https://github.com/fraxken)! - `RuntimeCore` assigns its world to `globalThis.game`, which the ECS `World` no longer does.
  `RigidBodyEditView` extends `ActorComponent`, the ECS `Component` interface being gone.

- [#1207](https://github.com/JollyPixel/editor/pull/1207) [`f7572a4`](https://github.com/JollyPixel/editor/commit/f7572a4db2e9219c4fda9dc67277c16162e68b52) Thanks [@fraxken](https://github.com/fraxken)! - Split the engine into a renderer-agnostic core (`@jolly-pixel/ecs`) and a three.js backend (`@jolly-pixel/backend.three`). Actors no longer own an `object3D`: the engine owns the transform and pushes it to a `SceneGraph` node (`ThreeSceneGraph`, `HeadlessSceneGraph`), typed per backend: `actor.node.object3D` and `world.sceneManager.graph.scene`.
  `SceneManager` takes its graph, `getSource()`, `default`, `addChildren`/`removeChildren` and `SceneEnvironment` are gone, and `World` gets its audio from the graph. `RigidBody` reads the engine transform.

- [#1207](https://github.com/JollyPixel/editor/pull/1207) [`c9f075a`](https://github.com/JollyPixel/editor/commit/c9f075a25e55927134b0b2f649a3c1178f06d61b) Thanks [@fraxken](https://github.com/fraxken)! - Drop `get`/`set` method prefixes. `Transform` exposes read-only `local` and `global` spaces that own `move`, `rotate` and `place` (`transform.global.position = v`); actors use `findComponent`, `findActor` and `reparent`; renderers expose `source` and `lockAspectRatio`; sprite, model animation and logger setters become properties.
  `VoxelWorld`, `VoxelLayer` and `VoxelChunk` read with `voxelAt`, `packedAt`, `partnerAt`, `findLayer`, `chunkAt`, `chunks()` and write with `placeVoxel`, `writeVoxelAt` and `writePackedAt`; block registries drop `values()` for iteration.

- [#1279](https://github.com/JollyPixel/editor/pull/1279) [`cd88847`](https://github.com/JollyPixel/editor/commit/cd88847e7a7c8005a36c785768eeae6132e46e60) Thanks [@fraxken](https://github.com/fraxken)! - Add `@jolly-pixel/math`: allocation-free `vec3`, `quat` and `mat4` tuple math checked against three.js, replacing the pmndrs `math` dependency in ecs and physics.

- [#1232](https://github.com/JollyPixel/editor/pull/1232) [`70b0e15`](https://github.com/JollyPixel/editor/commit/70b0e15d612fa6f9720d81af22e743f51eeebff2) Thanks [@fraxken](https://github.com/fraxken)! - Update three.js to 0.187.0.
  `BakedRoomEnvironment` now bakes a 64 pixel PMREM cube with 4 mip levels, and `createRenderTarget` returns a `CubeRenderTarget` (generated on the WebGL 2 fallback).
- Updated dependencies []:
  - @jolly-pixel/ecs@1.0.1
