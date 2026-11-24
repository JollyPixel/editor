# @jolly-pixel/runtime

## 7.0.1

### Patch Changes

- Updated dependencies [[`f711a5f`](https://github.com/JollyPixel/editor/commit/f711a5ff57a7d3513f7d2edb9a469b1f08884b25)]:
  - @jolly-pixel/utils@1.1.1
  - @jolly-pixel/ui@5.0.1
  - @jolly-pixel/loop@2.0.0

## 7.0.0

### Major Changes

- [#1278](https://github.com/JollyPixel/editor/pull/1278) [`1741696`](https://github.com/JollyPixel/editor/commit/1741696a2c80e5330d54140e9b4a5c34f5e490c8) Thanks [@fraxken](https://github.com/fraxken)! - Replace `@jolly-pixel/engine` with `@jolly-pixel/ecs`, a renderer-agnostic core, and `@jolly-pixel/backend.three` for three.js and the browser `Runtime`. `@jolly-pixel/runtime` now only exports `RuntimeCore` and its overlay and metrics.

- [#1280](https://github.com/JollyPixel/editor/pull/1280) [`6db7837`](https://github.com/JollyPixel/editor/commit/6db78372636061b7cdb561051c73ea9c6f719618) Thanks [@fraxken](https://github.com/fraxken)! - `runtime.metrics` owns the HUD and panel: use `metrics.hud`, `metrics.mountPanel()` and `runtime.stats`. Read `runtime.loop.sleeping` instead of `runtime.idle`.

### Minor Changes

- [#1214](https://github.com/JollyPixel/editor/pull/1214) [`d1dfafc`](https://github.com/JollyPixel/editor/commit/d1dfafc41e11fd3bf790f83393d199eea9d59082) Thanks [@fraxken](https://github.com/fraxken)! - Packages can give a game its components and asset loaders through `Systems.ComponentPackage`.

- [#1173](https://github.com/JollyPixel/editor/pull/1173) [`30fe2f0`](https://github.com/JollyPixel/editor/commit/30fe2f0b2a9f2636d3b9c39827257743a746f258) Thanks [@fraxken](https://github.com/fraxken)! - Add a renderer-agnostic `RuntimeCore` and `RuntimeBackend` contract at `@jolly-pixel/runtime`; `Runtime` is now the three.js backend built on it.
  Add `runtime.metrics.mount()`. `RuntimeMetrics` takes any metric source for `renderer`.

- [#1225](https://github.com/JollyPixel/editor/pull/1225) [`b8d702d`](https://github.com/JollyPixel/editor/commit/b8d702d7da9e919b194ad25bdbca76aa86c95311) Thanks [@fraxken](https://github.com/fraxken)! - A scene skips, with a warning, a component whose asset is missing instead of failing to load. `Runtime.create` takes `worldLogger`.

### Patch Changes

- [#1280](https://github.com/JollyPixel/editor/pull/1280) [`dc99a29`](https://github.com/JollyPixel/editor/commit/dc99a2924185d97da740f597eb3b79de323a566b) Thanks [@fraxken](https://github.com/fraxken)! - `RuntimeCore` assigns its world to `globalThis.game`, which the ECS `World` no longer does.
  `RigidBodyEditView` extends `ActorComponent`, the ECS `Component` interface being gone.

- [#1207](https://github.com/JollyPixel/editor/pull/1207) [`f7572a4`](https://github.com/JollyPixel/editor/commit/f7572a4db2e9219c4fda9dc67277c16162e68b52) Thanks [@fraxken](https://github.com/fraxken)! - Split the engine into `@jolly-pixel/ecs` and `@jolly-pixel/backend.three`. Actors no longer own an `object3D`: use `actor.node.object3D`.

- [#1207](https://github.com/JollyPixel/editor/pull/1207) [`c9f075a`](https://github.com/JollyPixel/editor/commit/c9f075a25e55927134b0b2f649a3c1178f06d61b) Thanks [@fraxken](https://github.com/fraxken)! - Drop `get`/`set` method prefixes: `Transform` exposes `local` and `global` spaces, and voxel worlds read with `voxelAt` and write with `placeVoxel`.

- [#1088](https://github.com/JollyPixel/editor/pull/1088) [`ce24126`](https://github.com/JollyPixel/editor/commit/ce241266470accee7375a2f45745c0c71f0ce1e1) Thanks [@fraxken](https://github.com/fraxken)! - Register UI elements from `@jolly-pixel/ui/elements/<name>` and import the facade from `@jolly-pixel/ui/facade`; the root entry no longer registers anything.

- [#1214](https://github.com/JollyPixel/editor/pull/1214) [`814127c`](https://github.com/JollyPixel/editor/commit/814127c359d544bc17b1f0de11112579d4f84bd2) Thanks [@fraxken](https://github.com/fraxken)! - The runtime loading screen shows the decoded file name of each asset instead of its full path or URL.
  The `jolly-loading` asset label no longer grows wider than the screen because of its padding.

- [#1252](https://github.com/JollyPixel/editor/pull/1252) [`91c5144`](https://github.com/JollyPixel/editor/commit/91c51448e025127047f15d0da7624adb0ace17bf) Thanks [@fraxken](https://github.com/fraxken)! - `load()` now renders desktop displays at their native pixel ratio, up to `2`, instead of capping it at `1`, which blurred scaled and HiDPI screens.

- [#1232](https://github.com/JollyPixel/editor/pull/1232) [`70b0e15`](https://github.com/JollyPixel/editor/commit/70b0e15d612fa6f9720d81af22e743f51eeebff2) Thanks [@fraxken](https://github.com/fraxken)! - Update three.js to 0.187.0.
  `BakedRoomEnvironment` now bakes a 64 pixel PMREM cube with 4 mip levels, and `createRenderTarget` returns a `CubeRenderTarget` (generated on the WebGL 2 fallback).

- [#1234](https://github.com/JollyPixel/editor/pull/1234) [`90c9692`](https://github.com/JollyPixel/editor/commit/90c9692fc0508e2b784c097ed119090bfe07e850) Thanks [@fraxken](https://github.com/fraxken)! - Move shared helpers such as `delay`, `withTimeout`, `DeepReadonly` and `sha256Hex` into `@jolly-pixel/utils`.

- [#1192](https://github.com/JollyPixel/editor/pull/1192) [`d26da53`](https://github.com/JollyPixel/editor/commit/d26da53c969781c9c1c3062f6f0b6df2f5b8ecfa) Thanks [@fraxken](https://github.com/fraxken)! - Add `@jolly-pixel/utils` for shared helpers; `saveFile` and `formatBytes` move there from `@jolly-pixel/ui`.
- Updated dependencies [[`ec79d3f`](https://github.com/JollyPixel/editor/commit/ec79d3f32c41f9c43ea81271e805fe48416e1d6a), [`5b2019f`](https://github.com/JollyPixel/editor/commit/5b2019f7ae2624255c6c2ac3ea510fe817005ac0), [`b7d2f82`](https://github.com/JollyPixel/editor/commit/b7d2f8249cb29ac71e78cb7e92730a2d818d567f), [`c41299e`](https://github.com/JollyPixel/editor/commit/c41299eab87538146550d8b4576f1516cd62badc), [`7e29f56`](https://github.com/JollyPixel/editor/commit/7e29f562bacca1d65487e7503078054dfb7f6d58), [`5494a67`](https://github.com/JollyPixel/editor/commit/5494a67d7495071378b5eae430d51ef034cb5c35), [`1172e00`](https://github.com/JollyPixel/editor/commit/1172e00ffa43d52a158fdf48ec47550cb856da6b), [`cb05510`](https://github.com/JollyPixel/editor/commit/cb0551060632c2efc33c4af9018b4428fe8b1707), [`0d95f1f`](https://github.com/JollyPixel/editor/commit/0d95f1f55a3020accd4e947a833aa68960267526), [`c1f706c`](https://github.com/JollyPixel/editor/commit/c1f706ca4946937ef4a76648c8ab15cbdc93dadf), [`40d00c4`](https://github.com/JollyPixel/editor/commit/40d00c45ca7946f8205cc8cdb01ff043af5d0c16), [`74a48b4`](https://github.com/JollyPixel/editor/commit/74a48b4b1ff967b5025ede4b3a6d719cd36bdeb0), [`9fd6a1c`](https://github.com/JollyPixel/editor/commit/9fd6a1c4bc8629aeafc8ebdd0e062d2e1527bf13), [`5974b66`](https://github.com/JollyPixel/editor/commit/5974b66d6663c265b1baa904f90f39407aec2dd6), [`63fd8b0`](https://github.com/JollyPixel/editor/commit/63fd8b0e8da8d86609df90d1c12dfd8a68522310), [`ce24126`](https://github.com/JollyPixel/editor/commit/ce241266470accee7375a2f45745c0c71f0ce1e1), [`7d1f07d`](https://github.com/JollyPixel/editor/commit/7d1f07da916e2f63622e4d3f49e24a4c4d3742ec), [`814127c`](https://github.com/JollyPixel/editor/commit/814127c359d544bc17b1f0de11112579d4f84bd2), [`505d6e0`](https://github.com/JollyPixel/editor/commit/505d6e0444dc3bc5bcb365486f085c169eb2caa8), [`40b7a52`](https://github.com/JollyPixel/editor/commit/40b7a52eb6d394cfb4959aeb07abe807fb599bb0), [`5237776`](https://github.com/JollyPixel/editor/commit/52377760dd35b9d5cf280119a7a2ea9f26852ab5), [`b8d702d`](https://github.com/JollyPixel/editor/commit/b8d702d7da9e919b194ad25bdbca76aa86c95311), [`947911a`](https://github.com/JollyPixel/editor/commit/947911ad6309a2b4a922cfc8eea1360f8aeb2c55), [`5af0632`](https://github.com/JollyPixel/editor/commit/5af0632f9ae65a6005861f839adb4e97d22c209f), [`2716e31`](https://github.com/JollyPixel/editor/commit/2716e316cc176144c6cb2f13551f89556750648c), [`f5350de`](https://github.com/JollyPixel/editor/commit/f5350de576d82af8592928a4456f43702befff26), [`0aa07e6`](https://github.com/JollyPixel/editor/commit/0aa07e6c2d954691e463ebc1c2ed2def6fbf9916), [`3f99e1d`](https://github.com/JollyPixel/editor/commit/3f99e1d2343d203f0f0c366b784c16ae782e317a), [`58361ea`](https://github.com/JollyPixel/editor/commit/58361ea65885b094c8876ceeb058d508f126fbc2), [`bfc3fbb`](https://github.com/JollyPixel/editor/commit/bfc3fbb7102c6e8292b5a2ae1e9ab7549004b20d), [`0572352`](https://github.com/JollyPixel/editor/commit/0572352e155d80126f71a0b0ad2f765f3c4f45ae), [`82061f5`](https://github.com/JollyPixel/editor/commit/82061f554182b7413961a8a92a14e10a088192ba), [`e083d5c`](https://github.com/JollyPixel/editor/commit/e083d5c062837c944609484f833d462eb9f88a52), [`b940847`](https://github.com/JollyPixel/editor/commit/b940847119a5b02966ffa9db8fc70e3f0d91b651), [`b940847`](https://github.com/JollyPixel/editor/commit/b940847119a5b02966ffa9db8fc70e3f0d91b651), [`5f7d6ec`](https://github.com/JollyPixel/editor/commit/5f7d6ece37213086613de6e79259efff5a7a0718), [`063c4aa`](https://github.com/JollyPixel/editor/commit/063c4aac17e1c73d74ac2c2309a8c25174fb8d52), [`9d2fe7a`](https://github.com/JollyPixel/editor/commit/9d2fe7a12a1c99c72d87b73cb8fe11c072a82ae9), [`f4be520`](https://github.com/JollyPixel/editor/commit/f4be52084e187c8738a78a80bd22aade1d95af3b), [`24991a6`](https://github.com/JollyPixel/editor/commit/24991a6edf1f7230b9268ffa647151ebe52d808e), [`47f8ad5`](https://github.com/JollyPixel/editor/commit/47f8ad5fecaa97928e0ed7d446d8345fc8e96ae3), [`6268c47`](https://github.com/JollyPixel/editor/commit/6268c4717783c25bda4ab5542b1c32959c18da39), [`3bfec4a`](https://github.com/JollyPixel/editor/commit/3bfec4aa2597e4923db19237593bcd928ff5f93a), [`b13074b`](https://github.com/JollyPixel/editor/commit/b13074b8ae53a3a6b454cc0572d88aca747d17de), [`a2e6a27`](https://github.com/JollyPixel/editor/commit/a2e6a27dc11dedbd444ea7698158f320f1cb4402), [`a287fa7`](https://github.com/JollyPixel/editor/commit/a287fa7d5d01b07d93f672b5147b6c9aebba0901), [`fee3858`](https://github.com/JollyPixel/editor/commit/fee3858c166edfccffe9c218020c1ffc38b5ca53), [`0ca160a`](https://github.com/JollyPixel/editor/commit/0ca160ad8fb9a86333f5c8766c20cb96fd1e1aea), [`f998437`](https://github.com/JollyPixel/editor/commit/f998437cc19077ec578beaf254cc826407e378f5), [`90c9692`](https://github.com/JollyPixel/editor/commit/90c9692fc0508e2b784c097ed119090bfe07e850), [`974ed36`](https://github.com/JollyPixel/editor/commit/974ed36053e2e6aab2a71cbc7e47e3e0fcb77f58), [`d26da53`](https://github.com/JollyPixel/editor/commit/d26da53c969781c9c1c3062f6f0b6df2f5b8ecfa)]:
  - @jolly-pixel/asset@5.0.0
  - @jolly-pixel/ui@5.0.0
  - @jolly-pixel/utils@1.1.0
  - @jolly-pixel/loop@2.0.0

## 6.1.0

### Minor Changes

- [#1015](https://github.com/JollyPixel/editor/pull/1015) [`02b3191`](https://github.com/JollyPixel/editor/commit/02b3191adf3f5b2dbc5df5e8768d5434ae3b0351) Thanks [@fraxken](https://github.com/fraxken)! - `ThreeRenderer` compiles every render pipeline asynchronously and adds `pendingCompiles`, `compiled()` and a `compiled` event; `Renderer` gains `compiled()`.
  `Runtime` requests a frame when compiles settle and adds `compiledFrame()`.

- [#951](https://github.com/JollyPixel/editor/pull/951) [`86af3d5`](https://github.com/JollyPixel/editor/commit/86af3d5b5e2fcc0ca9db56460add568776bde5eb) Thanks [@fraxken](https://github.com/fraxken)! - Support KTX2 compressed textures: the `texture` kind claims `.ktx2`, and `Runtime` builds a loader from `assets.ktx2.transcoderPath`.

- [#1017](https://github.com/JollyPixel/editor/pull/1017) [`02ab0a3`](https://github.com/JollyPixel/editor/commit/02ab0a3a9eeef46f26b5d45846c057249729b3c3) Thanks [@fraxken](https://github.com/fraxken)! - `GameLoop` takes an `idleDelay` before it sleeps. The runtime sets it to 2 s with `renderOnDemand` in place of rendering every frame while the pointer hovers the canvas.
  `StatsRecorder.skipGap()` keeps the time the loop slept out of the FPS graph.

- [#1017](https://github.com/JollyPixel/editor/pull/1017) [`ef53bff`](https://github.com/JollyPixel/editor/commit/ef53bffdee8da6977b57e22b7e7cc76d7b26335f) Thanks [@fraxken](https://github.com/fraxken)! - `runtime.metrics.renderer` adds a `gpuTime` metric (ms) when the renderer is created with `webgpu.trackTimestamp` on a device with `timestamp-query`.

- [#1026](https://github.com/JollyPixel/editor/pull/1026) [`5dc9a72`](https://github.com/JollyPixel/editor/commit/5dc9a72fcf0488ed6eeda05a8b667f4458b13ee9) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - `MetricsPanelOptions` accepts a `signal`: aborting it unmounts the panel and clears `RuntimeMetrics.panel`.
  A mount aborted before it resolves is dropped and the current panel stays in place.

- [#957](https://github.com/JollyPixel/editor/pull/957) [`063705c`](https://github.com/JollyPixel/editor/commit/063705c0799707d75118cf98729a0f693082ecfc) Thanks [@fraxken](https://github.com/fraxken)! - Add `runtime.statsHud` and `runtime.viewHelper`, each with a `hidden` property, so the corner performance HUD and the axis gizmo can be hidden without remounting them.

- [#917](https://github.com/JollyPixel/editor/pull/917) [`deaf77f`](https://github.com/JollyPixel/editor/commit/deaf77f2cdd8ecd8e24602c0014efd17672617c0) Thanks [@fraxken](https://github.com/fraxken)! - `ThreeRenderer` reports a lost device, the model loader decodes Meshopt glTF, and `VoxelView.meshVersion` lets a host keep a static shadow map.

### Patch Changes

- [#1071](https://github.com/JollyPixel/editor/pull/1071) [`32d05ac`](https://github.com/JollyPixel/editor/commit/32d05acf969fc7b09067ffcda2fcea0e6191fbcd) Thanks [@fraxken](https://github.com/fraxken)! - Add `AssetKind` and `AssetPath`, which replace `AssetSource`; asset records carry `path` instead of `source`.

- [#1018](https://github.com/JollyPixel/editor/pull/1018) [`c9726dc`](https://github.com/JollyPixel/editor/commit/c9726dc516927b5d119e066e7dfa0a1bca536eaf) Thanks [@fraxken](https://github.com/fraxken)! - Model loaders and the KTX2 loader load on first use. Catalog types validate with `zod/mini`, so malformed shapes throw `$ZodError`.

- [#855](https://github.com/JollyPixel/editor/pull/855) [`13a706d`](https://github.com/JollyPixel/editor/commit/13a706dc84a7dfaafc925ead7932eb6199533203) Thanks [@fraxken](https://github.com/fraxken)! - With `renderOnDemand`, the runtime keeps rendering while the pointer hovers the canvas, and an idle runtime no longer misses the first gamepad press.
- Updated dependencies [[`c0643f9`](https://github.com/JollyPixel/editor/commit/c0643f9978941d93eb2fee7ca4d524fc20e23339), [`6358611`](https://github.com/JollyPixel/editor/commit/6358611ff4dc5d3f789cb643c66d10db38fbd6bc), [`32d05ac`](https://github.com/JollyPixel/editor/commit/32d05acf969fc7b09067ffcda2fcea0e6191fbcd), [`02b3191`](https://github.com/JollyPixel/editor/commit/02b3191adf3f5b2dbc5df5e8768d5434ae3b0351), [`d225112`](https://github.com/JollyPixel/editor/commit/d2251127dac7d6b2ca8f4bf123331062156d645f), [`d866130`](https://github.com/JollyPixel/editor/commit/d86613035c5f949c9449ce152bd5a8bcd570bac5), [`86dbb95`](https://github.com/JollyPixel/editor/commit/86dbb95270aae8eb3cc89a76d518a51fe93faebf), [`5d51844`](https://github.com/JollyPixel/editor/commit/5d51844c63797adadd53070d1080e1c151cf343e), [`6b9daee`](https://github.com/JollyPixel/editor/commit/6b9daee5304c6bf06fd77086633e682d35640afc), [`2ea51da`](https://github.com/JollyPixel/editor/commit/2ea51dad091d4f8ac132948e1c6a5e4d54268b78), [`8d789e8`](https://github.com/JollyPixel/editor/commit/8d789e8052b3501dbac4d3e4e08a8f0a27a34fbc), [`61b6d3b`](https://github.com/JollyPixel/editor/commit/61b6d3bb65427a2f00e13db26975b369f3da87ca), [`f03cb7a`](https://github.com/JollyPixel/editor/commit/f03cb7a89b574ba6965f3b88d0ad5796de6cbdce), [`c9726dc`](https://github.com/JollyPixel/editor/commit/c9726dc516927b5d119e066e7dfa0a1bca536eaf), [`e5178c2`](https://github.com/JollyPixel/editor/commit/e5178c28b3650f6edddc97208f0f31168f628768), [`48dd303`](https://github.com/JollyPixel/editor/commit/48dd3038b36246492b62bdd6e71137dd1d3d9c3e), [`98cbd2b`](https://github.com/JollyPixel/editor/commit/98cbd2b36acf3752a62d18a2bb5b6c8a505cc311), [`912d0f7`](https://github.com/JollyPixel/editor/commit/912d0f702ab8697c5a501df6289674e97c498059), [`3930fc1`](https://github.com/JollyPixel/editor/commit/3930fc1d7e43399788478c135d7e4e81140f66d4), [`b762b50`](https://github.com/JollyPixel/editor/commit/b762b50ba6c24516b700c7c2673e19777a25c5f1), [`a23ea74`](https://github.com/JollyPixel/editor/commit/a23ea74dca38f8684e890f0abed659277ccc230e), [`9ed0ad8`](https://github.com/JollyPixel/editor/commit/9ed0ad82e1bc15518d64314cf1859dee71c1bb5d), [`9123c45`](https://github.com/JollyPixel/editor/commit/9123c4578d791cb8f9d3749e56d2c8268ee87ec7), [`86af3d5`](https://github.com/JollyPixel/editor/commit/86af3d5b5e2fcc0ca9db56460add568776bde5eb), [`ef2c7fe`](https://github.com/JollyPixel/editor/commit/ef2c7fe37e1d532b745e6462c26bb9f650ccc875), [`b624786`](https://github.com/JollyPixel/editor/commit/b624786135da5a7205deb53f21042ccde88dc4e7), [`a314267`](https://github.com/JollyPixel/editor/commit/a31426763c1e8c41f5bb56d97a826c9ad5a2c41b), [`66697bd`](https://github.com/JollyPixel/editor/commit/66697bd469e84f261a4b1a018720b92d33befd04), [`837a08f`](https://github.com/JollyPixel/editor/commit/837a08fc80a0b41a1f2c0549fff8f6423db9066b), [`f949b80`](https://github.com/JollyPixel/editor/commit/f949b807ba586adee8b88f476261334eef8a703a), [`5f66fe9`](https://github.com/JollyPixel/editor/commit/5f66fe99d7d1b7cb1df7c1383f2fa60ba6acf6cd), [`12dca6e`](https://github.com/JollyPixel/editor/commit/12dca6e98be8b71f9ef8517edcc17d8e8520fb72), [`bc29b43`](https://github.com/JollyPixel/editor/commit/bc29b4307c5a3b485f6b2006c11f4a832b73284b), [`c48eb65`](https://github.com/JollyPixel/editor/commit/c48eb652bfa73fd56580f861023e2651cfafd78c), [`a75ee6d`](https://github.com/JollyPixel/editor/commit/a75ee6dc5ef94c274f0f3b69d8eeff73e018e495), [`e1808f6`](https://github.com/JollyPixel/editor/commit/e1808f6a02cf3569d5838a601dcc0946d8fbb164), [`0436e3c`](https://github.com/JollyPixel/editor/commit/0436e3c645a2d717b90bb407ce41eb412beb4943), [`02ab0a3`](https://github.com/JollyPixel/editor/commit/02ab0a3a9eeef46f26b5d45846c057249729b3c3), [`a11f91d`](https://github.com/JollyPixel/editor/commit/a11f91da7ecf7e2b9f3e778641788eb5707a8d90), [`f20007a`](https://github.com/JollyPixel/editor/commit/f20007a1717a9b9bbab779489156c36451be38a0), [`f724870`](https://github.com/JollyPixel/editor/commit/f72487033a8df5e7077e37780082c72f7c99688a), [`695ee81`](https://github.com/JollyPixel/editor/commit/695ee81072bd90cae25c03e5e850ce214153278b), [`b9d33d2`](https://github.com/JollyPixel/editor/commit/b9d33d2d2ec359f25f3656c35a42dbabda2b8511), [`77b25de`](https://github.com/JollyPixel/editor/commit/77b25de87c5e3c05f248336adc7722dc628cad2e), [`6b9daee`](https://github.com/JollyPixel/editor/commit/6b9daee5304c6bf06fd77086633e682d35640afc), [`33f6b2f`](https://github.com/JollyPixel/editor/commit/33f6b2f3a7c5ced091a3500480fbd2160f5ffcc0), [`e1e86cb`](https://github.com/JollyPixel/editor/commit/e1e86cb232b5e021d839a58b8b68013194308349), [`deaf77f`](https://github.com/JollyPixel/editor/commit/deaf77f2cdd8ecd8e24602c0014efd17672617c0), [`51c9b58`](https://github.com/JollyPixel/editor/commit/51c9b58a6d5d6f279413d82be26c9d92609905c9), [`4421c8b`](https://github.com/JollyPixel/editor/commit/4421c8b06e9cfcb229a55b9dc2fd3455927ac1ed), [`e9ac1e6`](https://github.com/JollyPixel/editor/commit/e9ac1e683040f050fc92d1d5a4276548fc9140c4), [`5e9f29d`](https://github.com/JollyPixel/editor/commit/5e9f29d41de26d6bc738f36e8cb5f80b03a55e90), [`e89d8e0`](https://github.com/JollyPixel/editor/commit/e89d8e06fc1a22f7656cd8519d7f6c2730497780), [`695ee81`](https://github.com/JollyPixel/editor/commit/695ee81072bd90cae25c03e5e850ce214153278b), [`3e9603a`](https://github.com/JollyPixel/editor/commit/3e9603ad94b7a4751a13e7232651a584b93a75e2), [`8b23ca1`](https://github.com/JollyPixel/editor/commit/8b23ca10136cc59275aa3ce407565af4fb3d9b31), [`2f1c4ad`](https://github.com/JollyPixel/editor/commit/2f1c4ad18ecb8ce413d3951899c6096af666e9fb), [`26b8b55`](https://github.com/JollyPixel/editor/commit/26b8b551d00aa70ea11b7b7e0097f70c1da43dc3), [`d4b3ad1`](https://github.com/JollyPixel/editor/commit/d4b3ad1a7cab4677c23f671e391ae95b2dffe860), [`e780033`](https://github.com/JollyPixel/editor/commit/e7800335b131d45645d4a62459684993d8b87af8), [`75902c5`](https://github.com/JollyPixel/editor/commit/75902c51ba6fb64d72d322e9bc73a80e8dcfbce2), [`ceee3f6`](https://github.com/JollyPixel/editor/commit/ceee3f60b3422e54a0728ada8521c01c87b9f852), [`84a0b61`](https://github.com/JollyPixel/editor/commit/84a0b61b324f2dacab6da416e4bcc8ac9e2b144f), [`dd36165`](https://github.com/JollyPixel/editor/commit/dd36165a7cc2a6f90dfcaf03442850d57a743d4d), [`4647e7d`](https://github.com/JollyPixel/editor/commit/4647e7dc2eeb6a9c331677fdc06440c4e049f556), [`85641f5`](https://github.com/JollyPixel/editor/commit/85641f5459de96c87aea28ae1ec5ef564991a760), [`c8bd1d3`](https://github.com/JollyPixel/editor/commit/c8bd1d34da241745911653c270f36f9b87de229e), [`425cef9`](https://github.com/JollyPixel/editor/commit/425cef984d0c6e5bf06f99fa29e0282acb47350b), [`9bbb3dd`](https://github.com/JollyPixel/editor/commit/9bbb3ddede95f64780d8a3b2865ea39178abc40b), [`c86b214`](https://github.com/JollyPixel/editor/commit/c86b214c710a64428fa251465f3bcd7984471a36), [`d3cc3ee`](https://github.com/JollyPixel/editor/commit/d3cc3ee8679f691f130274eadd074ca717e52346)]:
  - @jolly-pixel/ui@4.0.0
  - @jolly-pixel/asset@4.0.0
  - @jolly-pixel/engine@7.1.0
  - @jolly-pixel/loop@2.0.0

## 6.0.0

### Major Changes

- [#801](https://github.com/JollyPixel/editor/pull/801) [`e7383a4`](https://github.com/JollyPixel/editor/commit/e7383a4b93414ca3334f8ff9440f9da8fd8c2279) Thanks [@fraxken](https://github.com/fraxken)! - `SceneManager` loads scene assets through `world.assetCoordinator`; `SceneLoader` and `setSceneLoader()` are removed. Use `runtime.stats` instead of the metrics `recorder`.

### Minor Changes

- [#839](https://github.com/JollyPixel/editor/pull/839) [`6e6ca8b`](https://github.com/JollyPixel/editor/commit/6e6ca8b6aa3be1af5f4cf35b6e18f8de261712db) Thanks [@fraxken](https://github.com/fraxken)! - Add `Systems.Logger.step()`, which logs an awaited operation as started, done with its duration, or failed.
  `RuntimeOptions` accepts a `logger` that receives the startup steps of `create()` and `load()`, then the wait for the first frame.

- [#845](https://github.com/JollyPixel/editor/pull/845) [`399e1e4`](https://github.com/JollyPixel/editor/commit/399e1e448a7cab33990ccb000c381ec266060de5) Thanks [@fraxken](https://github.com/fraxken)! - Add `renderOnDemand` to `Runtime`: the loop sleeps when nothing changes, and cameras, voxel views and peer syncs request the frames they need. Room joins load a much smaller snapshot.

- [#791](https://github.com/JollyPixel/editor/pull/791) [`b4574c7`](https://github.com/JollyPixel/editor/commit/b4574c71334e5c21b871d66785348f67c1407744) Thanks [@fraxken](https://github.com/fraxken)! - Add a `filter` option to `mountMetricsPanel()` so a readout can leave out metrics, such as the ones the corner HUD already cycles through.

- [#791](https://github.com/JollyPixel/editor/pull/791) [`31f0081`](https://github.com/JollyPixel/editor/commit/31f0081bca20cd835f4302d868413a702d31b9b1) Thanks [@fraxken](https://github.com/fraxken)! - Expose the renderer counters as `runtime.metrics.renderer`: `frame` returns the draw calls and triangles latched on the last `draw`, safe to read outside a draw handler.

- [#771](https://github.com/JollyPixel/editor/pull/771) [`e606d65`](https://github.com/JollyPixel/editor/commit/e606d657b056d1e20f04a30f8cb2305f19fe9865) Thanks [@fraxken](https://github.com/fraxken)! - `Runtime.create()` forwards a `renderer` option, and an explicit `output.pixelRatio` is no longer overwritten by GPU detection.

- [#841](https://github.com/JollyPixel/editor/pull/841) [`71d300a`](https://github.com/JollyPixel/editor/commit/71d300a76e87200b52cb4a1e9394ce22793c2a8a) Thanks [@fraxken](https://github.com/fraxken)! - Add `suspendWhenHidden` to pause the loop while the page is hidden. `load({ maxFps })` skips GPU benchmarking.

- [#803](https://github.com/JollyPixel/editor/pull/803) [`ab4ad1a`](https://github.com/JollyPixel/editor/commit/ab4ad1a00b61463b39aaaae73644ca329898b8de) Thanks [@fraxken](https://github.com/fraxken)! - Remove `VoxelEngine`: `VoxelRenderer` exposes `document` and `view`, and greedy meshing is replaced by vertex pulling with optional Web Worker meshing. GPU memory is now reported in the metrics.

### Patch Changes

- [#797](https://github.com/JollyPixel/editor/pull/797) [`3cf031e`](https://github.com/JollyPixel/editor/commit/3cf031ef217963e8611171c56028ff7839d6ddc5) Thanks [@fraxken](https://github.com/fraxken)! - `start()` after `stop()` resumes the runtime again: it clears the exit flag `stop()` sets, which previously stopped the runtime on its first tick.

- [#789](https://github.com/JollyPixel/editor/pull/789) [`b520e7e`](https://github.com/JollyPixel/editor/commit/b520e7e37c000763a492f68635af528ca461a285) Thanks [@fraxken](https://github.com/fraxken)! - Package subpaths follow one naming scheme (`/node`, `/client`, `/browser`), and every package declares `exports`; for example, import `event-store/node` instead of `event-store/sqlite`. Package roots are browser-safe.
- Updated dependencies [[`3795267`](https://github.com/JollyPixel/editor/commit/37952670b39501299cd97be272d1da1704f68c97), [`0db872e`](https://github.com/JollyPixel/editor/commit/0db872e6e3567a4a0deca4ad6bda0b30d3b643c9), [`6e6ca8b`](https://github.com/JollyPixel/editor/commit/6e6ca8b6aa3be1af5f4cf35b6e18f8de261712db), [`e606d65`](https://github.com/JollyPixel/editor/commit/e606d657b056d1e20f04a30f8cb2305f19fe9865), [`921c7a6`](https://github.com/JollyPixel/editor/commit/921c7a6ae7195ba5099b964416145865eff269e4), [`bd7b3d3`](https://github.com/JollyPixel/editor/commit/bd7b3d3c346826673e9de8d14286a8573c253fe1), [`399e1e4`](https://github.com/JollyPixel/editor/commit/399e1e448a7cab33990ccb000c381ec266060de5), [`175845f`](https://github.com/JollyPixel/editor/commit/175845ff00ccac8ae8a81472543feb5345b6f2a1), [`e1c4a2d`](https://github.com/JollyPixel/editor/commit/e1c4a2d163156a30dd89a432fd801eb23c4687c4), [`46ea926`](https://github.com/JollyPixel/editor/commit/46ea926b7946125a538f7bb885a5a8e0788f9418), [`799d17c`](https://github.com/JollyPixel/editor/commit/799d17cd8d7732d84664b0109648fb353bd3ad0e), [`e7383a4`](https://github.com/JollyPixel/editor/commit/e7383a4b93414ca3334f8ff9440f9da8fd8c2279), [`f2182da`](https://github.com/JollyPixel/editor/commit/f2182da4d77756bf62bf2c12d4ca2a41fedd76ab), [`71d300a`](https://github.com/JollyPixel/editor/commit/71d300a76e87200b52cb4a1e9394ce22793c2a8a), [`e1c4a2d`](https://github.com/JollyPixel/editor/commit/e1c4a2d163156a30dd89a432fd801eb23c4687c4), [`a54b8a8`](https://github.com/JollyPixel/editor/commit/a54b8a8bdf5597293fcb1a960ed35aeb0a57d603), [`75d0d66`](https://github.com/JollyPixel/editor/commit/75d0d666a436bb8399fda93930da84c16b02f93a), [`6339aea`](https://github.com/JollyPixel/editor/commit/6339aea20bf9777054eec1e6cb828d40fe96c3cc), [`ad38d4e`](https://github.com/JollyPixel/editor/commit/ad38d4e8935e0a759c0d4f7add3771ab0543f9b0), [`10f797b`](https://github.com/JollyPixel/editor/commit/10f797bb711798024f7ed82ed6c615e12de54e3d), [`b691bbf`](https://github.com/JollyPixel/editor/commit/b691bbf91d44d5d5fa65d32165e6d0688d82e06a), [`1452db0`](https://github.com/JollyPixel/editor/commit/1452db0b72b073fbb4c5c46fd37dfe748da1e7f7), [`b520e7e`](https://github.com/JollyPixel/editor/commit/b520e7e37c000763a492f68635af528ca461a285), [`ab4ad1a`](https://github.com/JollyPixel/editor/commit/ab4ad1a00b61463b39aaaae73644ca329898b8de)]:
  - @jolly-pixel/ui@3.2.0
  - @jolly-pixel/asset@3.0.0
  - @jolly-pixel/engine@7.0.0
  - @jolly-pixel/loop@1.1.0

## 5.2.0

### Minor Changes

- [#765](https://github.com/JollyPixel/editor/pull/765) [`f92e245`](https://github.com/JollyPixel/editor/commit/f92e2453211663158b04606da2008ba25cc35529) Thanks [@fraxken](https://github.com/fraxken)! - Add `Runtime.nextFrame()`/`frames(count)`, `VoxelEngine.whenIdle()`, `projectToClient()` in three,
  and `textureClientPosition()` on the pixel-draw canvas viewport (typed `CanvasViewport`).

- [#748](https://github.com/JollyPixel/editor/pull/748) [`54c361c`](https://github.com/JollyPixel/editor/commit/54c361c02b8f7ddf26cf71e0453f8f224566cffc) Thanks [@fraxken](https://github.com/fraxken)! - Own performance metrics in the runtime: a subsystem describes what it counts
  through the structural `MetricSource`, `runtime.metrics` registers it on one
  recorder, and `mountMetricsPanel()` builds a dockable readout from them.

- [#709](https://github.com/JollyPixel/editor/pull/709) [`3b91a42`](https://github.com/JollyPixel/editor/commit/3b91a42d560941a003b777f57060fe18972dc4c8) Thanks [@fraxken](https://github.com/fraxken)! - Move the camera view helper into the runtime as a `viewHelper` option that follows the lowest-depth camera.
  The engine drops `createViewHelper`, `OrbitFlyCamera` drops its `viewHelper` option, and `Renderer` exposes `renderComponents`.

### Patch Changes

- [#707](https://github.com/JollyPixel/editor/pull/707) [`0bbc913`](https://github.com/JollyPixel/editor/commit/0bbc91316d992bd0e23609df326632efd1cc7d82) Thanks [@fraxken](https://github.com/fraxken)! - Fix double actor destruction, leaked teardowns, playlists stopping after one track and non-looping sprite animations. Components now override `onDestroy()`.
- Updated dependencies [[`9e4b7a1`](https://github.com/JollyPixel/editor/commit/9e4b7a16d5348458027d06eafc68baf51ca4f519), [`f7b4ec2`](https://github.com/JollyPixel/editor/commit/f7b4ec2fea370220bba2d2ca68f0cb570ed80fcf), [`956a942`](https://github.com/JollyPixel/editor/commit/956a942bec3670dc9cb0a9714a3abe2843330688), [`566c46f`](https://github.com/JollyPixel/editor/commit/566c46f6a0ecab46dd1950f747a1fdb3e764d46a), [`0bbc913`](https://github.com/JollyPixel/editor/commit/0bbc91316d992bd0e23609df326632efd1cc7d82), [`60d0df3`](https://github.com/JollyPixel/editor/commit/60d0df3699f65c5dc38bff6a2458db1c2f05bee0), [`267f172`](https://github.com/JollyPixel/editor/commit/267f172136cd77d1b16b67e3734ff068b65d2fb0), [`54c361c`](https://github.com/JollyPixel/editor/commit/54c361c02b8f7ddf26cf71e0453f8f224566cffc), [`3b91a42`](https://github.com/JollyPixel/editor/commit/3b91a42d560941a003b777f57060fe18972dc4c8), [`94c4da8`](https://github.com/JollyPixel/editor/commit/94c4da893f24adfbf59d1031d3c3731c9b4ff567), [`d6e1b5a`](https://github.com/JollyPixel/editor/commit/d6e1b5a976b4571d78051502df570e85d5b50cce), [`2bb278b`](https://github.com/JollyPixel/editor/commit/2bb278b095453aa8bf1e66c4d5fb36b98a9647cb), [`4ae4d68`](https://github.com/JollyPixel/editor/commit/4ae4d683df8328d306023260732c1efc787acd98)]:
  - @jolly-pixel/asset@2.1.0
  - @jolly-pixel/ui@3.1.0
  - @jolly-pixel/engine@6.0.0
  - @jolly-pixel/loop@1.0.0

## 5.1.0

### Minor Changes

- [#683](https://github.com/JollyPixel/editor/pull/683) [`537b8b6`](https://github.com/JollyPixel/editor/commit/537b8b6cc297309d8bfadca2ae4189483e517dde) Thanks [@fraxken](https://github.com/fraxken)! - Add `runtime.overlay`: the performance HUD and focus hint follow the canvas instead of the window corner.

### Patch Changes

- [#699](https://github.com/JollyPixel/editor/pull/699) [`9f5cb54`](https://github.com/JollyPixel/editor/commit/9f5cb5412ba47200793de247e3de53e21e8b7ec4) Thanks [@fraxken](https://github.com/fraxken)! - Update three.js to 0.186.0.
  `disposeObject3D` now ignores the base `Object3D.dispose` added in 0.186, so a plain mesh's geometry and material are freed again.
  `snapValue` normalizes a negative zero result to positive zero.
- Updated dependencies [[`60bef9d`](https://github.com/JollyPixel/editor/commit/60bef9d4d51f63a269e31f26d1817399708f8b6a), [`ab65462`](https://github.com/JollyPixel/editor/commit/ab65462597390541cdb2bee98a7aa22dff562c69), [`2fbcaeb`](https://github.com/JollyPixel/editor/commit/2fbcaeb78ac80e4ce706ae66c2c6203513d439c4), [`bd77308`](https://github.com/JollyPixel/editor/commit/bd773087b83d357491bd56e0e3d60808f2ee5434), [`bb3e894`](https://github.com/JollyPixel/editor/commit/bb3e89489f37e83b2435b3d41fa208e2e53aa3ad), [`b91d177`](https://github.com/JollyPixel/editor/commit/b91d1777197a160daafd69ed4857ff9ea3c999c4), [`81f9fcc`](https://github.com/JollyPixel/editor/commit/81f9fcc003a62bb102e5f0cfb4cf439165778ccf), [`271fba9`](https://github.com/JollyPixel/editor/commit/271fba955fe79253b972a13daf0419a696138788), [`bd77308`](https://github.com/JollyPixel/editor/commit/bd773087b83d357491bd56e0e3d60808f2ee5434), [`d8f9e21`](https://github.com/JollyPixel/editor/commit/d8f9e21ba3dfb92135c83f909e542b8cbe668fa7), [`c9c7379`](https://github.com/JollyPixel/editor/commit/c9c7379f0e9e1255eb1fb8f88bc660fec32c249a), [`60bef9d`](https://github.com/JollyPixel/editor/commit/60bef9d4d51f63a269e31f26d1817399708f8b6a), [`9f5cb54`](https://github.com/JollyPixel/editor/commit/9f5cb5412ba47200793de247e3de53e21e8b7ec4), [`1e16c34`](https://github.com/JollyPixel/editor/commit/1e16c343d63da08745ad1fdeb12c3dd83364e573), [`3b06ff8`](https://github.com/JollyPixel/editor/commit/3b06ff841b592848f538af79b60b75456d7d5842), [`be5e8bf`](https://github.com/JollyPixel/editor/commit/be5e8bfa64d4a0b17dfac90ab37ec6e9208330d1), [`25fd361`](https://github.com/JollyPixel/editor/commit/25fd361714e6bb55f8fa61f0404d85a055e245f7), [`2371afa`](https://github.com/JollyPixel/editor/commit/2371afaaff5dd986b36c3ea20a101146ec12b795), [`15f358a`](https://github.com/JollyPixel/editor/commit/15f358a223cd8fc57d10b9a800a5b5b2edcb0268), [`c1d08b8`](https://github.com/JollyPixel/editor/commit/c1d08b8ee5c6d196172c623b0906b10d1061ab40), [`73b40f6`](https://github.com/JollyPixel/editor/commit/73b40f63553c35fbda9fcd6cc6ed472a63cabebb), [`6895753`](https://github.com/JollyPixel/editor/commit/6895753c6e09c43758357ee5997b981ce5c401ac)]:
  - @jolly-pixel/ui@3.0.0
  - @jolly-pixel/engine@5.1.0
  - @jolly-pixel/asset@2.0.0
  - @jolly-pixel/loop@1.0.0

## 5.0.0

### Major Changes

- [#516](https://github.com/JollyPixel/editor/pull/516) [`66ee3e0`](https://github.com/JollyPixel/editor/commit/66ee3e0740bcf6ec96a507ad47c9d565a9750a48) Thanks [@fraxken](https://github.com/fraxken)! - Implement a new loop engine/workspace

- [#626](https://github.com/JollyPixel/editor/pull/626) [`d9a6038`](https://github.com/JollyPixel/editor/commit/d9a603815146600e435493f5c316c564d85fa9da) Thanks [@fraxken](https://github.com/fraxken)! - Move startup loading to `Runtime.load()` and remove the standalone `loadRuntime`
  and `resolveRuntimeCanvas` exports. Rename `LoadRuntimeOptions` to
  `RuntimeLoadOptions`.

### Minor Changes

- [#521](https://github.com/JollyPixel/editor/pull/521) [`02bc332`](https://github.com/JollyPixel/editor/commit/02bc3329e46bf536727ad696140dc7d09ccccb92) Thanks [@fraxken](https://github.com/fraxken)! - Refactor voxel-map editor to use @jolly-pixel/ui components (+ diverses bug fixes)

- [#529](https://github.com/JollyPixel/editor/pull/529) [`2db69a8`](https://github.com/JollyPixel/editor/commit/2db69a870c0ef3f5375c53cf2661ef23d43584a4) Thanks [@fraxken](https://github.com/fraxken)! - Add `Mouse.scroll` for signed wheel magnitude and keep drags alive once the
  cursor leaves the canvas. `Runtime.load()`/`configureRuntimeDevice` accept
  `maxFps` to override the GPU-benchmarked render cap.

- [#626](https://github.com/JollyPixel/editor/pull/626) [`0bb2043`](https://github.com/JollyPixel/editor/commit/0bb20431dccea174bd9ffc43e720963ce07efae0) Thanks [@fraxken](https://github.com/fraxken)! - Add a `focusHint` runtime option that overlays a translucent "Click to focus"
  label on the canvas while it does not hold keyboard focus. Disabled by default,
  freely anchored among nine positions with a configurable inset and text.

- [#489](https://github.com/JollyPixel/editor/pull/489) [`e83c39b`](https://github.com/JollyPixel/editor/commit/e83c39bdc271493400eecce3acd9b6568262f845) Thanks [@fraxken](https://github.com/fraxken)! - Move input controls inside the new @jolly-pixel/controls package (workspace)

- [#487](https://github.com/JollyPixel/editor/pull/487) [`71953e5`](https://github.com/JollyPixel/editor/commit/71953e5e7d63eddb44702d8ab8897536e27b363f) Thanks [@fraxken](https://github.com/fraxken)! - Add the DOM-free `StatsRecorder` API and the themeable, cycling `jolly-stats` performance HUD. Replace stats.js with the JollyPixel recorder and HUD, with optional mounting and top-corner placement.

- [#497](https://github.com/JollyPixel/editor/pull/497) [`09c6b49`](https://github.com/JollyPixel/editor/commit/09c6b49ef18895cfccc2d30b4c250e56fdeaeff7) Thanks [@fraxken](https://github.com/fraxken)! - Add a new option to skip entirely the loading screen

- [#558](https://github.com/JollyPixel/editor/pull/558) [`d177aad`](https://github.com/JollyPixel/editor/commit/d177aad67d137804b3599a16a62554a6d18c0c27) Thanks [@fraxken](https://github.com/fraxken)! - `Runtime.create()` now accepts a CSS selector in addition to an
  `HTMLCanvasElement`, removing the manual `document.querySelector` and
  null-check boilerplate from every call site.

- [#486](https://github.com/JollyPixel/editor/pull/486) [`d89455e`](https://github.com/JollyPixel/editor/commit/d89455e2093dd644ee67debadd0d7177857a6a59) Thanks [@fraxken](https://github.com/fraxken)! - Implement <jolly-progress> and <jolly-loading> inside UI and use them in runtime

### Patch Changes

- Updated dependencies [[`d9e0b8a`](https://github.com/JollyPixel/editor/commit/d9e0b8aa2edec5a0dc77f16d676e7daeb93be117), [`939ac02`](https://github.com/JollyPixel/editor/commit/939ac022b35ae9cf5e0e1d3210731cee8fcbc32d), [`02bc332`](https://github.com/JollyPixel/editor/commit/02bc3329e46bf536727ad696140dc7d09ccccb92), [`66ee3e0`](https://github.com/JollyPixel/editor/commit/66ee3e0740bcf6ec96a507ad47c9d565a9750a48), [`014dbb0`](https://github.com/JollyPixel/editor/commit/014dbb0f4d5be9e3df8caefbbab47365f8a7fbf5), [`db58ed4`](https://github.com/JollyPixel/editor/commit/db58ed4f87cd137eb7e3a0470e75febcbad5034b), [`18842ab`](https://github.com/JollyPixel/editor/commit/18842abe5ad347f63eacf8254d0685cba235adee), [`72b75c0`](https://github.com/JollyPixel/editor/commit/72b75c0e550e1dc261d9f86a6864b29e91cc3b8e), [`b4a7046`](https://github.com/JollyPixel/editor/commit/b4a704691b17dfec6cafc637c757c937913632b4), [`cf4816d`](https://github.com/JollyPixel/editor/commit/cf4816dc112090f4b0e90d9c417e4817a8b2f956), [`4618512`](https://github.com/JollyPixel/editor/commit/46185125cdefbcc0dd821c82612afc13e2696aec), [`e83c39b`](https://github.com/JollyPixel/editor/commit/e83c39bdc271493400eecce3acd9b6568262f845), [`3bde59b`](https://github.com/JollyPixel/editor/commit/3bde59b0a25d61653b3200849c64bf93c3d30c8d), [`981f340`](https://github.com/JollyPixel/editor/commit/981f340f5933b21508a8b5acca991c8e44b451d0), [`71953e5`](https://github.com/JollyPixel/editor/commit/71953e5e7d63eddb44702d8ab8897536e27b363f), [`2391a21`](https://github.com/JollyPixel/editor/commit/2391a213543812f357d99f25d3a7ba58e33a57f2), [`9b87bfe`](https://github.com/JollyPixel/editor/commit/9b87bfe6de642aaf3ea9d25a09dd3b022bb8f8dc), [`19e1012`](https://github.com/JollyPixel/editor/commit/19e1012fa8b3260b38212a462a62addba8f1b5de), [`c5e4f38`](https://github.com/JollyPixel/editor/commit/c5e4f38bafbc56cfba7a5de5d5f66e3ed1cf6f65), [`33cba8e`](https://github.com/JollyPixel/editor/commit/33cba8e750bdd4cac96f409c3cf310159f73ad20), [`8cce611`](https://github.com/JollyPixel/editor/commit/8cce611bbaa0b9e393834fc373b8aac81ae7f04f), [`a0f07ca`](https://github.com/JollyPixel/editor/commit/a0f07ca1f5d8ba66dd4819688602b51942036c1b), [`cd04886`](https://github.com/JollyPixel/editor/commit/cd048869b91af6a09ff56c73b8701b47fc13d78e), [`a9a6ca8`](https://github.com/JollyPixel/editor/commit/a9a6ca8279097ff6e64a800f797a96ab21597e1b), [`82ce3e8`](https://github.com/JollyPixel/editor/commit/82ce3e8139f436f25676c1b7bcd8447e1b4db416), [`3bde59b`](https://github.com/JollyPixel/editor/commit/3bde59b0a25d61653b3200849c64bf93c3d30c8d), [`e55decb`](https://github.com/JollyPixel/editor/commit/e55decba8f0dbc35f1351ea3218360de0b5dbfc1), [`b4a7046`](https://github.com/JollyPixel/editor/commit/b4a704691b17dfec6cafc637c757c937913632b4), [`245bc85`](https://github.com/JollyPixel/editor/commit/245bc850a6f0798459b2e829ad99add3e0510c54), [`cd200eb`](https://github.com/JollyPixel/editor/commit/cd200ebf5440b27cecc74221104deae7e7bf9be6), [`eec5e52`](https://github.com/JollyPixel/editor/commit/eec5e52f462e33212e05f474e9ed44aee5a33a82), [`bf18d36`](https://github.com/JollyPixel/editor/commit/bf18d36840b7be32ca239b865c7a21dab0510afb), [`444fba8`](https://github.com/JollyPixel/editor/commit/444fba8abd23c4407f84e3110c53fec1f3710496), [`ac50655`](https://github.com/JollyPixel/editor/commit/ac50655063011ff4f1ec7bddd78a95ef77fd6f56), [`d89455e`](https://github.com/JollyPixel/editor/commit/d89455e2093dd644ee67debadd0d7177857a6a59), [`578fded`](https://github.com/JollyPixel/editor/commit/578fded23cd3e7a81b9a80d20f9571244398e633)]:
  - @jolly-pixel/ui@2.0.0
  - @jolly-pixel/engine@5.0.0
  - @jolly-pixel/asset@1.1.0

## 4.0.0

### Major Changes

- [#445](https://github.com/JollyPixel/editor/pull/445) [`cd85d69`](https://github.com/JollyPixel/editor/commit/cd85d697ec3cbe8f25e4edd0c531016d0c371d9c) Thanks [@fraxken](https://github.com/fraxken)! - Runtime built-in SVG icon, custom parentContainer, custom CSS with ShadowDOM

- [#411](https://github.com/JollyPixel/editor/pull/411) [`10fef00`](https://github.com/JollyPixel/editor/commit/10fef008eae61e8b8cb163a80c66c82ae68ab98e) Thanks [@fraxken](https://github.com/fraxken)! - Switch the rendering pipeline from `THREE.WebGLRenderer` to `THREE.WebGPURenderer` (`three/webgpu`), which renders natively on WebGPU and automatically falls back to a WebGL2 backend when WebGPU isn't available.

### Minor Changes

- [#377](https://github.com/JollyPixel/editor/pull/377) [`6dd2fc7`](https://github.com/JollyPixel/editor/commit/6dd2fc79cf5711b8b99e1fc85e0e8471ed8b7f31) Thanks [@fraxken](https://github.com/fraxken)! - Cameras follow their actor, `Camera3DControls` keeps its options, and the renderer is configurable and released on dispose. Move cameras through `actor.transform`; writes to `camera.position` are now overwritten.

### Patch Changes

- Updated dependencies [[`7f4df3f`](https://github.com/JollyPixel/editor/commit/7f4df3f69d15899a991e874e3c85ec1c8a70d29d), [`6dd2fc7`](https://github.com/JollyPixel/editor/commit/6dd2fc79cf5711b8b99e1fc85e0e8471ed8b7f31), [`feaf15c`](https://github.com/JollyPixel/editor/commit/feaf15c26a42e6099994de0fee452f0350dececf), [`10fef00`](https://github.com/JollyPixel/editor/commit/10fef008eae61e8b8cb163a80c66c82ae68ab98e)]:
  - @jolly-pixel/engine@4.0.0

## 3.4.0

### Minor Changes

- [#310](https://github.com/JollyPixel/editor/pull/310) [`6447779`](https://github.com/JollyPixel/editor/commit/64477791f5dae06af2f420d61d872c3c2d97103e) Thanks [@fraxken](https://github.com/fraxken)! - Expose TMJ loading as a plugins in voxel.renderer and fix the TMJ example by preloading scene assets in engine and runtime

- [#246](https://github.com/JollyPixel/editor/pull/246) [`a2ce2a2`](https://github.com/JollyPixel/editor/commit/a2ce2a2fd6fc536de358b0d5ad966cd53882245c) Thanks [@fraxken](https://github.com/fraxken)! - Major refactor of AssetManager and loaders

### Patch Changes

- [#297](https://github.com/JollyPixel/editor/pull/297) [`0ac82f3`](https://github.com/JollyPixel/editor/commit/0ac82f3532ceae21b62421cf15dc60eeb4bd26c8) Thanks [@fraxken](https://github.com/fraxken)! - Require `three` `^0.185.1`, so projects no longer install two copies of three.js.

- Updated dependencies [[`6447779`](https://github.com/JollyPixel/editor/commit/64477791f5dae06af2f420d61d872c3c2d97103e), [`a9e412a`](https://github.com/JollyPixel/editor/commit/a9e412a6933a84fbecf390483ea35c857acec926), [`a2ce2a2`](https://github.com/JollyPixel/editor/commit/a2ce2a2fd6fc536de358b0d5ad966cd53882245c), [`4d22d1a`](https://github.com/JollyPixel/editor/commit/4d22d1aadb71a087b1d7472924d5dfabbb05fe77), [`3380d96`](https://github.com/JollyPixel/editor/commit/3380d968dbad604dffa68eebc947e1f75919f9ef), [`0ac82f3`](https://github.com/JollyPixel/editor/commit/0ac82f3532ceae21b62421cf15dc60eeb4bd26c8), [`0d913de`](https://github.com/JollyPixel/editor/commit/0d913de782055a6636b441a66f9c59461f343b3c)]:
  - @jolly-pixel/engine@3.0.0

## 3.3.0

### Minor Changes

- [#236](https://github.com/JollyPixel/editor/pull/236) [`dfff053`](https://github.com/JollyPixel/editor/commit/dfff05301b97c739b264b74515bb25f4ff3fbf38) Thanks [@fraxken](https://github.com/fraxken)! - Add a focusCanvas to disable permanent canvas focus listener

## 3.2.0

### Minor Changes

- [#175](https://github.com/JollyPixel/editor/pull/175) [`f50efc5`](https://github.com/JollyPixel/editor/commit/f50efc5a4962203a136f9bc5e604f9535ef0c11e) Thanks [@fraxken](https://github.com/fraxken)! - Enhance and fix bugs with Asset Management

### Patch Changes

- Updated dependencies [[`f50efc5`](https://github.com/JollyPixel/editor/commit/f50efc5a4962203a136f9bc5e604f9535ef0c11e), [`f48549e`](https://github.com/JollyPixel/editor/commit/f48549e90658b774a6913bbf8630c358630121ed)]:
  - @jolly-pixel/engine@2.2.0

## 3.1.0

### Minor Changes

- [#168](https://github.com/JollyPixel/editor/pull/168) [`dd4d9c6`](https://github.com/JollyPixel/editor/commit/dd4d9c6d51048e2debd5c6fbe279dbfc5dd2cb86) Thanks [@fraxken](https://github.com/fraxken)! - Re-implement part of the game loop into World and expose hooks as EE

- [#162](https://github.com/JollyPixel/editor/pull/162) [`2a3261b`](https://github.com/JollyPixel/editor/commit/2a3261b5d7516a3e7e2cfe8612c8e214f4b029ac) Thanks [@fraxken](https://github.com/fraxken)! - Implement fixedUpdate lifecycle and enhance component with needUpdate

### Patch Changes

- [#159](https://github.com/JollyPixel/editor/pull/159) [`fb3e1b5`](https://github.com/JollyPixel/editor/commit/fb3e1b50ef7e7976c3411593ac3ba58168eb1f29) Thanks [@fraxken](https://github.com/fraxken)! - Fix loadRuntime so error throw in world.connect() can escalate the stack

- Updated dependencies [[`70f1b3b`](https://github.com/JollyPixel/editor/commit/70f1b3beefec61d38a8c0d1b617dd549540f406d), [`dd4d9c6`](https://github.com/JollyPixel/editor/commit/dd4d9c6d51048e2debd5c6fbe279dbfc5dd2cb86), [`2a3261b`](https://github.com/JollyPixel/editor/commit/2a3261b5d7516a3e7e2cfe8612c8e214f4b029ac), [`519f4f1`](https://github.com/JollyPixel/editor/commit/519f4f1c4b03373fce674b009ac48dc9a4ff4692)]:
  - @jolly-pixel/engine@2.1.0

## 3.0.0

### Major Changes

- [#157](https://github.com/JollyPixel/editor/pull/157) [`c3ca721`](https://github.com/JollyPixel/editor/commit/c3ca72107b76c40e6cb81785883c82b01ffc0a02) Thanks [@fraxken](https://github.com/fraxken)! - Major refactoring of ECS APIs (GameInstance -> World, Actor and ActorComponent breaking, SceneEngine -> SceneManager, new Transform APIs, etc)

### Patch Changes

- [#155](https://github.com/JollyPixel/editor/pull/155) [`c8405ca`](https://github.com/JollyPixel/editor/commit/c8405caba754802a9fdd5851411fa5af492c4e4b) Thanks [@fraxken](https://github.com/fraxken)! - Fix some mistake with newest GameInstance TContext generic and add a type GameInstanceDefaultContext to avoid repeting the default type everywhere

- Updated dependencies [[`c8405ca`](https://github.com/JollyPixel/editor/commit/c8405caba754802a9fdd5851411fa5af492c4e4b), [`c3ca721`](https://github.com/JollyPixel/editor/commit/c3ca72107b76c40e6cb81785883c82b01ffc0a02)]:
  - @jolly-pixel/engine@2.0.0

## 2.0.0

### Major Changes

- [#152](https://github.com/JollyPixel/editor/pull/152) [`ca274cf`](https://github.com/JollyPixel/editor/commit/ca274cf06e148676cfb30a129f19decfb1eed910) Thanks [@fraxken](https://github.com/fraxken)! - Rename Player to Runtime and introduce World context

### Minor Changes

- [#153](https://github.com/JollyPixel/editor/pull/153) [`06693b6`](https://github.com/JollyPixel/editor/commit/06693b6ffa77fc957c615df41d19f110fa8b5735) Thanks [@fraxken](https://github.com/fraxken)! - Configure three as peerDependencies

### Patch Changes

- Updated dependencies [[`06693b6`](https://github.com/JollyPixel/editor/commit/06693b6ffa77fc957c615df41d19f110fa8b5735), [`64a510e`](https://github.com/JollyPixel/editor/commit/64a510e4e1fd094958c20d03c9386115e8fad6ca), [`2bc5859`](https://github.com/JollyPixel/editor/commit/2bc5859c82e2118b1f49b1adaedba651a2490910), [`b8b2b30`](https://github.com/JollyPixel/editor/commit/b8b2b305291248fcdd786ea70809e6f2c73a4778), [`3668c6e`](https://github.com/JollyPixel/editor/commit/3668c6e9b48655a1138371684e2798e40b3e14f5)]:
  - @jolly-pixel/engine@1.3.0

## 1.1.0

### Minor Changes

- [#138](https://github.com/JollyPixel/editor/pull/138) [`8fd03e9`](https://github.com/JollyPixel/editor/commit/8fd03e9f43751bd05852b22af719a1dbfb0d8a8c) Thanks [@fraxken](https://github.com/fraxken)! - Integrate new FixedTimeStep for gameloop with fixedUpdate and classical update

### Patch Changes

- Updated dependencies [[`8fd03e9`](https://github.com/JollyPixel/editor/commit/8fd03e9f43751bd05852b22af719a1dbfb0d8a8c), [`2404b11`](https://github.com/JollyPixel/editor/commit/2404b11df9e57c624d84c2bed0cee7c36f0656c3), [`b080129`](https://github.com/JollyPixel/editor/commit/b080129f877bf61513dc555051d504683f986d76)]:
  - @jolly-pixel/engine@1.2.0
