# @jolly-pixel/voxel.renderer

## 2.0.0

### Major Changes

- [#268](https://github.com/JollyPixel/editor/pull/268) [`83b0dc4`](https://github.com/JollyPixel/editor/commit/83b0dc4b11cca367714ea9c90d43fb6830759d11) Thanks [@fraxken](https://github.com/fraxken)! - Implement new Network API to synchronize world between multiple clients

- [#272](https://github.com/JollyPixel/editor/pull/272) [`4d08bcb`](https://github.com/JollyPixel/editor/commit/4d08bcbda01fd011c68bf18be8315ecbf48c5338) Thanks [@fraxken](https://github.com/fraxken)! - Introduce a new class to preload Tileset textures and remove async APIs from VoxelRenderer class

### Minor Changes

- [#266](https://github.com/JollyPixel/editor/pull/266) [`9bcd1e2`](https://github.com/JollyPixel/editor/commit/9bcd1e2f85d19898c92465c0bec44dc8170b7521) Thanks [@fraxken](https://github.com/fraxken)! - Refactor hooks to have type-safe metadata

- [#269](https://github.com/JollyPixel/editor/pull/269) [`8989a96`](https://github.com/JollyPixel/editor/commit/8989a9640e13900817f0ecbabe1f814568495458) Thanks [@clemgbld](https://github.com/clemgbld)! - feat(voxel-renderer): Allow to copy (clone) an existing layer

- [#246](https://github.com/JollyPixel/editor/pull/246) [`a2ce2a2`](https://github.com/JollyPixel/editor/commit/a2ce2a2fd6fc536de358b0d5ad966cd53882245c) Thanks [@fraxken](https://github.com/fraxken)! - Major refactor of AssetManager and loaders

- [#273](https://github.com/JollyPixel/editor/pull/273) [`f495e19`](https://github.com/JollyPixel/editor/commit/f495e195251c6c168d9642aa0ad274aa4ba7fa52) Thanks [@fraxken](https://github.com/fraxken)! - Implement layers merging

- [#256](https://github.com/JollyPixel/editor/pull/256) [`8ab2ff7`](https://github.com/JollyPixel/editor/commit/8ab2ff79c026bfd78157b6a91cdad89bc43388db) Thanks [@fraxken](https://github.com/fraxken)! - Load a tileset synchronously by providing the texture

- [#238](https://github.com/JollyPixel/editor/pull/238) [`6e21474`](https://github.com/JollyPixel/editor/commit/6e214749382a3d62e7625885a2aab64afaffde32) Thanks [@clemgbld](https://github.com/clemgbld)! - refactor(voxel-renderer): improve BlockDefinition usability

- [#271](https://github.com/JollyPixel/editor/pull/271) [`48766e8`](https://github.com/JollyPixel/editor/commit/48766e888ea738dfba674bfd6316ea1cd481e5c5) Thanks [@fraxken](https://github.com/fraxken)! - Remove PoleCross and PoleX shape and keep PoleZ as Pole

- [#270](https://github.com/JollyPixel/editor/pull/270) [`6781b69`](https://github.com/JollyPixel/editor/commit/6781b69f66247f14f26d1086816f0573ae212c23) Thanks [@fraxken](https://github.com/fraxken)! - Refactor FaceDefinition to include culling in addition to face (properly splitting responsability between both)

### Patch Changes

- [#241](https://github.com/JollyPixel/editor/pull/241) [`69f882e`](https://github.com/JollyPixel/editor/commit/69f882e4162ea379d53730c4f4b767e2b99e820c) Thanks [@fraxken](https://github.com/fraxken)! - Avoid a bug with hidden face for shapes such as ramp or stair

- [#264](https://github.com/JollyPixel/editor/pull/264) [`09c7b05`](https://github.com/JollyPixel/editor/commit/09c7b05ef32baf6c78756e6348e441d9f6f1aa47) Thanks [@fraxken](https://github.com/fraxken)! - Remove chunk before rebuilding it

- [#239](https://github.com/JollyPixel/editor/pull/239) [`727c3cd`](https://github.com/JollyPixel/editor/commit/727c3cd92b5cd2d7758665d08b280ccf3ab1b628) Thanks [@fraxken](https://github.com/fraxken)! - Drain and remove empty VoxelLayer

- Updated dependencies [[`a2ce2a2`](https://github.com/JollyPixel/editor/commit/a2ce2a2fd6fc536de358b0d5ad966cd53882245c), [`4d22d1a`](https://github.com/JollyPixel/editor/commit/4d22d1aadb71a087b1d7472924d5dfabbb05fe77), [`3380d96`](https://github.com/JollyPixel/editor/commit/3380d968dbad604dffa68eebc947e1f75919f9ef)]:
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
