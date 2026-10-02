# @jolly-pixel/loop

## 1.1.0

### Minor Changes

- [#845](https://github.com/JollyPixel/editor/pull/845) [`399e1e4`](https://github.com/JollyPixel/editor/commit/399e1e448a7cab33990ccb000c381ec266060de5) Thanks [@fraxken](https://github.com/fraxken)! - Add `renderOnDemand` to `Runtime`, built on `GameLoop` `keepAlive`/`invalidate()` (sleeps after `trailingRenders`) and `FrameScheduler.skipGap()`, with `invalidate()`/`keepAlive()` on the engine `World` and `wasActive` on the controls `Input`.
  `OrbitFlyCamera`, `VoxelRenderer` (new `VoxelView` `requestFrame`) and `PeerFrustumSync` (new `requestFrame`, trailing pose publish) now request the frames they need.
  Joins receive a cached `encodeSnapshot()` form (PNG pixels: 2.7 MB to 165 KB for a 1024x512 tileset) that `CommandSync.applySnapshot` loads in order; a cold asset room restores its arbiter from the replay, and rooms share compiled validators through `MessageParser.of`.

- [#841](https://github.com/JollyPixel/editor/pull/841) [`71d300a`](https://github.com/JollyPixel/editor/commit/71d300a76e87200b52cb4a1e9394ce22793c2a8a) Thanks [@fraxken](https://github.com/fraxken)! - Add `AnimationLoopFrameSource` (moved from runtime) and `suspendWhenHidden` to loop, and the matching `suspendWhenHidden` runtime option.
  Runtime `load({ maxFps })` skips GPU benchmarking and loads `@pmndrs/detect-gpu` on demand.
  Concurrent joins of the same dynamic network room now share one resolver call.

### Patch Changes

- [#789](https://github.com/JollyPixel/editor/pull/789) [`b520e7e`](https://github.com/JollyPixel/editor/commit/b520e7e37c000763a492f68635af528ca461a285) Thanks [@fraxken](https://github.com/fraxken)! - Subpaths follow one naming scheme: `network/node` (now with the Vite plugin), `asset-server/{client,node}`, `asset-source/node`, `event-store/node` (was `./sqlite`), `image/browser` and `voxel.renderer/engine` (the Rapier plugin joins the root). `.ts` keys, wildcards, `network/parser` and `network/transport/*` are removed; transports ship from the network root, `./client` and `./node`.
  The `asset-server` and `asset-source` roots are now browser-safe and absorb `./backend`, `./kinds`, `./core` and `./indexeddb`; Node-only code moves to `./node`.
  Every published package declares `exports` instead of `main`/`types`, and the packages with no import-time side effects declare `"sideEffects": false`.
