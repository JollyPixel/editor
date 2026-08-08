# @jolly-pixel/network

## 1.1.0

### Minor Changes

- [#346](https://github.com/JollyPixel/editor/pull/346) [`2788a7e`](https://github.com/JollyPixel/editor/commit/2788a7e3c0d4f04ff22df415c4bd5270c3a1208a) Thanks [@fraxken](https://github.com/fraxken)! - Wire first implementation of @jolly-pixel/network

- [#369](https://github.com/JollyPixel/editor/pull/369) [`6f6594d`](https://github.com/JollyPixel/editor/commit/6f6594d9bea483ce53f61f3c92112c727d12bb7f) Thanks [@fraxken](https://github.com/fraxken)! - Implement minimal RBAC

- [#393](https://github.com/JollyPixel/editor/pull/393) [`1ead090`](https://github.com/JollyPixel/editor/commit/1ead09093bf7de77b56242d86693b49cae68b1e0) Thanks [@fraxken](https://github.com/fraxken)! - Implement Node.js worker_threads support for Extension

- [#347](https://github.com/JollyPixel/editor/pull/347) [`b568905`](https://github.com/JollyPixel/editor/commit/b56890527e918a637d41a17a7b41f1077268d04d) Thanks [@fraxken](https://github.com/fraxken)! - Improve network client API surface (reducing boilerplate required to setup a new client/connection).

- [#370](https://github.com/JollyPixel/editor/pull/370) [`36c570c`](https://github.com/JollyPixel/editor/commit/36c570cf5bef538b7c59bb64b987b86f07cc91b9) Thanks [@fraxken](https://github.com/fraxken)! - Implement a minimalist Event Store workspace

- [#364](https://github.com/JollyPixel/editor/pull/364) [`cd003c3`](https://github.com/JollyPixel/editor/commit/cd003c39463f09a0735d9a58a9ac7eea0217399d) Thanks [@fraxken](https://github.com/fraxken)! - Make the network implementation easier for workspaces

- [#364](https://github.com/JollyPixel/editor/pull/364) [`cd003c3`](https://github.com/JollyPixel/editor/commit/cd003c39463f09a0735d9a58a9ac7eea0217399d) Thanks [@fraxken](https://github.com/fraxken)! - Add `ConflictTracker`, a per-key wrapper around `ConflictResolver` that replaces the ad-hoc `Map` + get/resolve/set bookkeeping each `*SyncServer` (voxel-renderer, pixel-draw-renderer) used to repeat for itself.

- [#357](https://github.com/JollyPixel/editor/pull/357) [`53f66fa`](https://github.com/JollyPixel/editor/commit/53f66faee0df0be9c7500648c24e1f30918a8e32) Thanks [@fraxken](https://github.com/fraxken)! - Add peer identity and presence metadata. `NetworkClient` now supports connection-wide `identity`, and `NetworkChannel` now adds `updatePresence(patch)`, `onPeerPresence`, and a synced `peers` map (including initial `sync` state).

- [#361](https://github.com/JollyPixel/editor/pull/361) [`34c1d7b`](https://github.com/JollyPixel/editor/commit/34c1d7b85bdf25f89988160cfdee1edeb4f7cf2f) Thanks [@fraxken](https://github.com/fraxken)! - Re-implement the network stack

### Patch Changes

- Updated dependencies [[`adc9689`](https://github.com/JollyPixel/editor/commit/adc9689bce2a1ab743b5a7ccfbfc507408a3f0e1), [`36c570c`](https://github.com/JollyPixel/editor/commit/36c570cf5bef538b7c59bb64b987b86f07cc91b9)]:
  - @jolly-pixel/event-store@2.0.0
