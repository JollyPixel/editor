# @jolly-pixel/physics

## 2.0.0

### Major Changes

- [#1276](https://github.com/JollyPixel/editor/pull/1276) [`7d7aa9c`](https://github.com/JollyPixel/editor/commit/7d7aa9cedaf294a4fddfc03b166e575e8f3c9140) Thanks [@fraxken](https://github.com/fraxken)! - `SignalEvent.connect` returns a `SignalConnection`, and scene files wire signals to methods. `UISprite` signals are renamed (`pointerEntered`, `clicked`…) and `RigidBody.contacts` splits into `contactStarted` and `contactEnded`.

### Patch Changes

- [#1280](https://github.com/JollyPixel/editor/pull/1280) [`dc99a29`](https://github.com/JollyPixel/editor/commit/dc99a2924185d97da740f597eb3b79de323a566b) Thanks [@fraxken](https://github.com/fraxken)! - `RuntimeCore` assigns its world to `globalThis.game`, which the ECS `World` no longer does.
  `RigidBodyEditView` extends `ActorComponent`, the ECS `Component` interface being gone.

- [#1207](https://github.com/JollyPixel/editor/pull/1207) [`f7572a4`](https://github.com/JollyPixel/editor/commit/f7572a4db2e9219c4fda9dc67277c16162e68b52) Thanks [@fraxken](https://github.com/fraxken)! - Split the engine into `@jolly-pixel/ecs` and `@jolly-pixel/backend.three`. Actors no longer own an `object3D`: use `actor.node.object3D`.

- [#1207](https://github.com/JollyPixel/editor/pull/1207) [`c9f075a`](https://github.com/JollyPixel/editor/commit/c9f075a25e55927134b0b2f649a3c1178f06d61b) Thanks [@fraxken](https://github.com/fraxken)! - Drop `get`/`set` method prefixes: `Transform` exposes `local` and `global` spaces, and voxel worlds read with `voxelAt` and write with `placeVoxel`.

- [#1279](https://github.com/JollyPixel/editor/pull/1279) [`cd88847`](https://github.com/JollyPixel/editor/commit/cd88847e7a7c8005a36c785768eeae6132e46e60) Thanks [@fraxken](https://github.com/fraxken)! - Add `@jolly-pixel/math`: allocation-free `vec3`, `quat` and `mat4` tuple math checked against three.js, replacing the pmndrs `math` dependency in ecs and physics.

- [#1232](https://github.com/JollyPixel/editor/pull/1232) [`70b0e15`](https://github.com/JollyPixel/editor/commit/70b0e15d612fa6f9720d81af22e743f51eeebff2) Thanks [@fraxken](https://github.com/fraxken)! - Update three.js to 0.187.0.
  `BakedRoomEnvironment` now bakes a 64 pixel PMREM cube with 4 mip levels, and `createRenderTarget` returns a `CubeRenderTarget` (generated on the WebGL 2 fallback).
- Updated dependencies []:
  - @jolly-pixel/ecs@1.0.1
