# @jolly-pixel/voxel.renderer

## 3.0.0

### Major Changes

- [#373](https://github.com/JollyPixel/editor/pull/373) [`1e6ff52`](https://github.com/JollyPixel/editor/commit/1e6ff52068f9d82eb235ddb7f8194ba27b465d3d) Thanks [@fraxken](https://github.com/fraxken)! - Decouple `VoxelEngine` from Rapier3D behind a `VoxelCollider` interface.

- [#348](https://github.com/JollyPixel/editor/pull/348) [`32edc9a`](https://github.com/JollyPixel/editor/commit/32edc9a425ae53881aa044f6104911f4ae70d526) Thanks [@fraxken](https://github.com/fraxken)! - Migrate the network sync layer onto `@jolly-pixel/network`'s `NetworkPlugin`/`NetworkChannel` primitives, mirroring `@jolly-pixel/pixel-draw.renderer`'s design: `VoxelSyncServer` now extends `NetworkPlugin`, `VoxelTransport` matches `NetworkChannel`'s shape (`send`/single `onMessage`), and `VoxelSyncClient` is renamed to `VoxelSyncSession` with a two-step `attach(engine)`/`detach()` API that chains onto an existing `onLayerUpdated` handler instead of replacing it. `ConflictResolver`/`ConflictContext` are renamed to `VoxelConflictResolver`/`VoxelConflictContext`. `VoxelSnapshotRequest` and `VoxelTransport.requestSnapshot`/`sendCommand`/`onCommand`/`onSnapshot` are removed in favor of the new `VoxelServerMessage` envelope.

### Minor Changes

- [#381](https://github.com/JollyPixel/editor/pull/381) [`cc387f1`](https://github.com/JollyPixel/editor/commit/cc387f12b308fffe6af62ae2b1b05084af7502c0) Thanks [@fraxken](https://github.com/fraxken)! - Performance pass over voxel storage and meshing. On the 1024² noise-terrain benchmark (3,050,267 voxels, chunk 256, minimum of three runs) voxel generation drops 614 → 436 ms and meshing 1637 → 998 ms naive / 2455 → 1656 ms greedy, with byte-identical geometry. Resident buffers fall 523 → 445 MB naive and 358 → 326 MB greedy.

- [#369](https://github.com/JollyPixel/editor/pull/369) [`6f6594d`](https://github.com/JollyPixel/editor/commit/6f6594d9bea483ce53f61f3c92112c727d12bb7f) Thanks [@fraxken](https://github.com/fraxken)! - Implement minimal RBAC

- [#380](https://github.com/JollyPixel/editor/pull/380) [`7d0f58b`](https://github.com/JollyPixel/editor/commit/7d0f58b9f9b3915732f8e13b5392b04d0fee0ff7) Thanks [@fraxken](https://github.com/fraxken)! - Add optional greedy meshing to `VoxelEngine`, merging coplanar identical block faces into the largest quads possible instead of emitting one quad per voxel face. On the bundled noise-terrain benchmark it cuts triangles from 1,986,252 to 666,370 (3x) for roughly the same build time.

- [#370](https://github.com/JollyPixel/editor/pull/370) [`36c570c`](https://github.com/JollyPixel/editor/commit/36c570cf5bef538b7c59bb64b987b86f07cc91b9) Thanks [@fraxken](https://github.com/fraxken)! - Implement a minimalist Event Store workspace

- [#364](https://github.com/JollyPixel/editor/pull/364) [`cd003c3`](https://github.com/JollyPixel/editor/commit/cd003c39463f09a0735d9a58a9ac7eea0217399d) Thanks [@fraxken](https://github.com/fraxken)! - Make the network implementation easier for workspaces

- [#376](https://github.com/JollyPixel/editor/pull/376) [`a920533`](https://github.com/JollyPixel/editor/commit/a9205336bbcfd2e2684e13afa450136e9a07e579) Thanks [@fraxken](https://github.com/fraxken)! - Fix atlas bleeding that made distant voxels show white speckles and dark moiré bands.

- [#374](https://github.com/JollyPixel/editor/pull/374) [`d7a9ee4`](https://github.com/JollyPixel/editor/commit/d7a9ee4efd8a4639589dcbc78bd9e8b8d035be84) Thanks [@fraxken](https://github.com/fraxken)! - Speed up chunk meshing by roughly 5× on large worlds (a 1024×1024 noise world with 3M voxels drops from ~19s to ~3.5s at `chunkSize: 256`, and from ~28s to ~2.5s at the default `chunkSize: 16`).

- [#361](https://github.com/JollyPixel/editor/pull/361) [`34c1d7b`](https://github.com/JollyPixel/editor/commit/34c1d7b85bdf25f89988160cfdee1edeb4f7cf2f) Thanks [@fraxken](https://github.com/fraxken)! - Re-implement the network stack

- [#375](https://github.com/JollyPixel/editor/pull/375) [`6bfb934`](https://github.com/JollyPixel/editor/commit/6bfb934ada24bacbb099fdc25fa0ce5f02e29099) Thanks [@fraxken](https://github.com/fraxken)! - Add a debug mode to `VoxelEngine`: `engine.debug` exposes live mesh statistics (faces, culled faces, triangles, vertices, chunk meshes) and a wireframe view of the meshed chunks, toggled at runtime through `debug.mode` (`"off"` / `"overlay"` / `"wireframe"`).

### Patch Changes

- [#413](https://github.com/JollyPixel/editor/pull/413) [`f205674`](https://github.com/JollyPixel/editor/commit/f2056748fad22b8af0c1318d108af66cc9ed6bd2) Thanks [@fraxken](https://github.com/fraxken)! - Fix WebGPU renderer issue with greedy meshing & examples

- [#389](https://github.com/JollyPixel/editor/pull/389) [`8651b1b`](https://github.com/JollyPixel/editor/commit/8651b1b7e9f15d6c410156c1294a38e16cf00d00) Thanks [@fraxken](https://github.com/fraxken)! - Fix see-through blocks hiding the geometry behind them. `BlockDefinition` gains an optional `transparent` flag: such a block never occludes a neighbouring face, so a tile with alpha holes (leaves, a grate, a window) stops culling what you are meant to see through those holes.

- Updated dependencies [[`2788a7e`](https://github.com/JollyPixel/editor/commit/2788a7e3c0d4f04ff22df415c4bd5270c3a1208a), [`7f4df3f`](https://github.com/JollyPixel/editor/commit/7f4df3f69d15899a991e874e3c85ec1c8a70d29d), [`6f6594d`](https://github.com/JollyPixel/editor/commit/6f6594d9bea483ce53f61f3c92112c727d12bb7f), [`1ead090`](https://github.com/JollyPixel/editor/commit/1ead09093bf7de77b56242d86693b49cae68b1e0), [`b568905`](https://github.com/JollyPixel/editor/commit/b56890527e918a637d41a17a7b41f1077268d04d), [`4309016`](https://github.com/JollyPixel/editor/commit/4309016f04d38603c713c7a1a3f5e23e6e945076), [`36c570c`](https://github.com/JollyPixel/editor/commit/36c570cf5bef538b7c59bb64b987b86f07cc91b9), [`cf91f93`](https://github.com/JollyPixel/editor/commit/cf91f9336c32d8cc709a7915d2aa2fad264403c3), [`cd003c3`](https://github.com/JollyPixel/editor/commit/cd003c39463f09a0735d9a58a9ac7eea0217399d), [`6dd2fc7`](https://github.com/JollyPixel/editor/commit/6dd2fc79cf5711b8b99e1fc85e0e8471ed8b7f31), [`feaf15c`](https://github.com/JollyPixel/editor/commit/feaf15c26a42e6099994de0fee452f0350dececf), [`cd003c3`](https://github.com/JollyPixel/editor/commit/cd003c39463f09a0735d9a58a9ac7eea0217399d), [`53f66fa`](https://github.com/JollyPixel/editor/commit/53f66faee0df0be9c7500648c24e1f30918a8e32), [`34c1d7b`](https://github.com/JollyPixel/editor/commit/34c1d7b85bdf25f89988160cfdee1edeb4f7cf2f), [`10fef00`](https://github.com/JollyPixel/editor/commit/10fef008eae61e8b8cb163a80c66c82ae68ab98e)]:
  - @jolly-pixel/network@1.1.0
  - @jolly-pixel/engine@4.0.0

## 2.0.0

### Major Changes

- [#310](https://github.com/JollyPixel/editor/pull/310) [`6447779`](https://github.com/JollyPixel/editor/commit/64477791f5dae06af2f420d61d872c3c2d97103e) Thanks [@fraxken](https://github.com/fraxken)! - Expose TMJ loading as a plugins in voxel.renderer and fix the TMJ example by preloading scene assets in engine and runtime

- [#268](https://github.com/JollyPixel/editor/pull/268) [`83b0dc4`](https://github.com/JollyPixel/editor/commit/83b0dc4b11cca367714ea9c90d43fb6830759d11) Thanks [@fraxken](https://github.com/fraxken)! - Implement new Network API to synchronize world between multiple clients

- [#294](https://github.com/JollyPixel/editor/pull/294) [`7b4d75c`](https://github.com/JollyPixel/editor/commit/7b4d75c8923b2d57608d0d9959e50b27fd9f5d87) Thanks [@fraxken](https://github.com/fraxken)! - Extract `VoxelEngine` from `VoxelRenderer` to remove the `@jolly-pixel/engine`
  dependency from the core voxel logic (world, layers, blocks, hooks, mesh
  building), so it can be used standalone (e.g. server-side). `VoxelRenderer`
  now only wires the ActorComponent lifecycle and exposes the engine as
  `vr.engine`. `VoxelSyncClientOptions.renderer` is renamed to `.engine` and
  now accepts a `VoxelEngine` directly.

- [#272](https://github.com/JollyPixel/editor/pull/272) [`4d08bcb`](https://github.com/JollyPixel/editor/commit/4d08bcbda01fd011c68bf18be8315ecbf48c5338) Thanks [@fraxken](https://github.com/fraxken)! - Introduce a new class to preload Tileset textures and remove async APIs from VoxelRenderer class

### Minor Changes

- [#266](https://github.com/JollyPixel/editor/pull/266) [`9bcd1e2`](https://github.com/JollyPixel/editor/commit/9bcd1e2f85d19898c92465c0bec44dc8170b7521) Thanks [@fraxken](https://github.com/fraxken)! - Refactor hooks to have type-safe metadata

- [#269](https://github.com/JollyPixel/editor/pull/269) [`8989a96`](https://github.com/JollyPixel/editor/commit/8989a9640e13900817f0ecbabe1f814568495458) Thanks [@clemgbld](https://github.com/clemgbld)! - feat(voxel-renderer): Allow to copy (clone) an existing layer

- [#246](https://github.com/JollyPixel/editor/pull/246) [`a2ce2a2`](https://github.com/JollyPixel/editor/commit/a2ce2a2fd6fc536de358b0d5ad966cd53882245c) Thanks [@fraxken](https://github.com/fraxken)! - Major refactor of AssetManager and loaders

- [#273](https://github.com/JollyPixel/editor/pull/273) [`f495e19`](https://github.com/JollyPixel/editor/commit/f495e195251c6c168d9642aa0ad274aa4ba7fa52) Thanks [@fraxken](https://github.com/fraxken)! - Implement layers merging

- [#256](https://github.com/JollyPixel/editor/pull/256) [`8ab2ff7`](https://github.com/JollyPixel/editor/commit/8ab2ff79c026bfd78157b6a91cdad89bc43388db) Thanks [@fraxken](https://github.com/fraxken)! - Load a tileset synchronously by providing the texture

- [#238](https://github.com/JollyPixel/editor/pull/238) [`6e21474`](https://github.com/JollyPixel/editor/commit/6e214749382a3d62e7625885a2aab64afaffde32) Thanks [@clemgbld](https://github.com/clemgbld)! - refactor(voxel-renderer): improve BlockDefinition usability

- [#293](https://github.com/JollyPixel/editor/pull/293) [`1f85350`](https://github.com/JollyPixel/editor/commit/1f85350e741a6b76db5de9700668724d51167f24) Thanks [@fraxken](https://github.com/fraxken)! - Integrate layer, material and block opacity support

- [#271](https://github.com/JollyPixel/editor/pull/271) [`48766e8`](https://github.com/JollyPixel/editor/commit/48766e888ea738dfba674bfd6316ea1cd481e5c5) Thanks [@fraxken](https://github.com/fraxken)! - Remove PoleCross and PoleX shape and keep PoleZ as Pole

- [#270](https://github.com/JollyPixel/editor/pull/270) [`6781b69`](https://github.com/JollyPixel/editor/commit/6781b69f66247f14f26d1086816f0573ae212c23) Thanks [@fraxken](https://github.com/fraxken)! - Refactor FaceDefinition to include culling in addition to face (properly splitting responsability between both)

### Patch Changes

- [#241](https://github.com/JollyPixel/editor/pull/241) [`69f882e`](https://github.com/JollyPixel/editor/commit/69f882e4162ea379d53730c4f4b767e2b99e820c) Thanks [@fraxken](https://github.com/fraxken)! - Avoid a bug with hidden face for shapes such as ramp or stair

- [#264](https://github.com/JollyPixel/editor/pull/264) [`09c7b05`](https://github.com/JollyPixel/editor/commit/09c7b05ef32baf6c78756e6348e441d9f6f1aa47) Thanks [@fraxken](https://github.com/fraxken)! - Remove chunk before rebuilding it

- [#239](https://github.com/JollyPixel/editor/pull/239) [`727c3cd`](https://github.com/JollyPixel/editor/commit/727c3cd92b5cd2d7758665d08b280ccf3ab1b628) Thanks [@fraxken](https://github.com/fraxken)! - Drain and remove empty VoxelLayer

- Updated dependencies [[`6447779`](https://github.com/JollyPixel/editor/commit/64477791f5dae06af2f420d61d872c3c2d97103e), [`a9e412a`](https://github.com/JollyPixel/editor/commit/a9e412a6933a84fbecf390483ea35c857acec926), [`a2ce2a2`](https://github.com/JollyPixel/editor/commit/a2ce2a2fd6fc536de358b0d5ad966cd53882245c), [`4d22d1a`](https://github.com/JollyPixel/editor/commit/4d22d1aadb71a087b1d7472924d5dfabbb05fe77), [`3380d96`](https://github.com/JollyPixel/editor/commit/3380d968dbad604dffa68eebc947e1f75919f9ef), [`0ac82f3`](https://github.com/JollyPixel/editor/commit/0ac82f3532ceae21b62421cf15dc60eeb4bd26c8), [`0d913de`](https://github.com/JollyPixel/editor/commit/0d913de782055a6636b441a66f9c59461f343b3c)]:
  - @jolly-pixel/engine@3.0.0

## 1.4.0

### Minor Changes

- [#235](https://github.com/JollyPixel/editor/pull/235) [`cb3c67f`](https://github.com/JollyPixel/editor/commit/cb3c67fb36c589e5149d395509c3785e7d930d8b) Thanks [@fraxken](https://github.com/fraxken)! - Implement inverted shape using flipY rotatation

- [#234](https://github.com/JollyPixel/editor/pull/234) [`09a961c`](https://github.com/JollyPixel/editor/commit/09a961cd4f84e03823f7de16fa05b41d6453af7b) Thanks [@fraxken](https://github.com/fraxken)! - Add new APIs to add and remove voxels in bulk

- [#232](https://github.com/JollyPixel/editor/pull/232) [`7659f64`](https://github.com/JollyPixel/editor/commit/7659f6450794d047a8657042874f573f6431e4a7) Thanks [@fraxken](https://github.com/fraxken)! - Implement new APIs to manage object layers

## 1.3.0

### Minor Changes

- [#231](https://github.com/JollyPixel/editor/pull/231) [`9c48ff8`](https://github.com/JollyPixel/editor/commit/9c48ff826937066c4448fa785e94bec68410ec2c) Thanks [@fraxken](https://github.com/fraxken)! - Add new methods to get the world center of a given layer

- [#230](https://github.com/JollyPixel/editor/pull/230) [`ddff2ce`](https://github.com/JollyPixel/editor/commit/ddff2ce2e2ce94eeba2181b3bca32afb2d77ee7c) Thanks [@fraxken](https://github.com/fraxken)! - Implement moveLayer() in VoxelRenderer and expose markAllChunksDirty()

- [#229](https://github.com/JollyPixel/editor/pull/229) [`95e3e77`](https://github.com/JollyPixel/editor/commit/95e3e773c81f677d313f0c65763392b854d82cd2) Thanks [@fraxken](https://github.com/fraxken)! - Implement getDefaultBlocks to TilesetManager class

### Patch Changes

- [#225](https://github.com/JollyPixel/editor/pull/225) [`e4d2666`](https://github.com/JollyPixel/editor/commit/e4d2666d81e644b56824334e348d7f7a7689bbed) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - fix stairConnerInner missing faces & add viewHelper

## 1.2.0

### Minor Changes

- [#218](https://github.com/JollyPixel/editor/pull/218) [`3ac563e`](https://github.com/JollyPixel/editor/commit/3ac563e7545c8ad2071e863ad5476ba34f7c4e44) Thanks [@fraxken](https://github.com/fraxken)! - Implement hooks callback for layer event in VoxelRenderer class

- [#222](https://github.com/JollyPixel/editor/pull/222) [`c862834`](https://github.com/JollyPixel/editor/commit/c862834cd874b4081d82db89f239614702eee499) Thanks [@fraxken](https://github.com/fraxken)! - Improve all VoxelRenderer documentations (format, missing APIs etc)

- [#212](https://github.com/JollyPixel/editor/pull/212) [`798c4be`](https://github.com/JollyPixel/editor/commit/798c4be9a07b12fe293dfe63b7001d077281786e) Thanks [@fraxken](https://github.com/fraxken)! - Implement Logger into VoxelRenderer

### Patch Changes

- [#220](https://github.com/JollyPixel/editor/pull/220) [`d83c3ed`](https://github.com/JollyPixel/editor/commit/d83c3ed4818315dd407eda9358133a6650ced772) Thanks [@fraxken](https://github.com/fraxken)! - Fix world and layer incorrect update (on layer removal and on visibility changes)

- [#219](https://github.com/JollyPixel/editor/pull/219) [`aeb0ba2`](https://github.com/JollyPixel/editor/commit/aeb0ba287822a70fc3e9a80c7ffd6574b9e57ed3) Thanks [@fraxken](https://github.com/fraxken)! - Add missing blocks definition when saving on VoxelRenderer

## 1.1.0

### Minor Changes

- [#204](https://github.com/JollyPixel/editor/pull/204) [`427a8af`](https://github.com/JollyPixel/editor/commit/427a8af6a68deb9209f04f9af477f839ecd2e95d) Thanks [@fraxken](https://github.com/fraxken)! - Allow to customize the material in VoxelRenderer options

- [#202](https://github.com/JollyPixel/editor/pull/202) [`9242c14`](https://github.com/JollyPixel/editor/commit/9242c14544f716f89b6ffd490ea673df06e80956) Thanks [@fraxken](https://github.com/fraxken)! - Expose and complete layer API on VoxelRenderer and implement tiled properties for layers. Also implement layer properties has a feature for our JSON format

## 1.0.2

### Patch Changes

- [#200](https://github.com/JollyPixel/editor/pull/200) [`a0b5a02`](https://github.com/JollyPixel/editor/commit/a0b5a0245e4b280299c349c871f6264d5e6c6c9c) Thanks [@fraxken](https://github.com/fraxken)! - VoxelRenderer should not expect context Generic for ActorComponent & Actor

## 1.0.1

### Patch Changes

- Updated dependencies [[`0db96b9`](https://github.com/JollyPixel/editor/commit/0db96b9f165c06e113e36b49be91715b7bd332a3), [`13028f1`](https://github.com/JollyPixel/editor/commit/13028f1e85b4f1044d5fb7f8ef0d02d00a9e66d4)]:
  - @jolly-pixel/engine@2.5.0
