# @jolly-pixel/voxel.renderer

## 9.0.2

### Patch Changes

- Updated dependencies [[`0164169`](https://github.com/JollyPixel/editor/commit/016416984dbc4246fa20cc6cdeb8f21bffbccad0)]:
  - @jolly-pixel/backend.three@1.0.3

## 9.0.1

### Patch Changes

- Updated dependencies []:
  - @jolly-pixel/backend.three@1.0.2

## 9.0.0

### Major Changes

- [#1278](https://github.com/JollyPixel/editor/pull/1278) [`1741696`](https://github.com/JollyPixel/editor/commit/1741696a2c80e5330d54140e9b4a5c34f5e490c8) Thanks [@fraxken](https://github.com/fraxken)! - Replace `@jolly-pixel/engine` with `@jolly-pixel/ecs`, a renderer-agnostic core, and `@jolly-pixel/backend.three` for three.js and the browser `Runtime`. `@jolly-pixel/runtime` now only exports `RuntimeCore` and its overlay and metrics.

- [#1175](https://github.com/JollyPixel/editor/pull/1175) [`174d961`](https://github.com/JollyPixel/editor/commit/174d9612d9543c5c966a9e4e22783094f017bb83) Thanks [@fraxken](https://github.com/fraxken)! - `BakedRoomEnvironment` moves to the engine as `Systems.BakedRoomEnvironment`. Actor and logger patterns only support `*`, `?` and `**`, and `three` is a `^0.186.0` peer dependency.

- [#1207](https://github.com/JollyPixel/editor/pull/1207) [`c9f075a`](https://github.com/JollyPixel/editor/commit/c9f075a25e55927134b0b2f649a3c1178f06d61b) Thanks [@fraxken](https://github.com/fraxken)! - Drop `get`/`set` method prefixes: `Transform` exposes `local` and `global` spaces, and voxel worlds read with `voxelAt` and write with `placeVoxel`.

- [#1181](https://github.com/JollyPixel/editor/pull/1181) [`fb5cc80`](https://github.com/JollyPixel/editor/commit/fb5cc80858789b6c6e9d4fb345bc8266e6f77dc2) Thanks [@fraxken](https://github.com/fraxken)! - Physics moves to `@jolly-pixel/physics`, with a Rapier backend in `@jolly-pixel/physics.rapier`; replace `RapierVoxelCollider` with `PhysicsVoxelCollider`.

### Minor Changes

- [#1132](https://github.com/JollyPixel/editor/pull/1132) [`5237776`](https://github.com/JollyPixel/editor/commit/52377760dd35b9d5cf280119a7a2ea9f26852ab5) Thanks [@fraxken](https://github.com/fraxken)! - `jolly-tree` gains `reveal(id)` to scroll a row into view and flash it. Add `VoxelMapAnchorKey` to `@jolly-pixel/voxel.renderer/engine`.

- [#1248](https://github.com/JollyPixel/editor/pull/1248) [`5b28d8b`](https://github.com/JollyPixel/editor/commit/5b28d8b4a0a06c1566afa19432017612a4fa7c76) Thanks [@fraxken](https://github.com/fraxken)! - Add shared environments (sky, sun, fog, tone mapping, glow) as an `environment` asset; `SceneFile.environment` is now a reference. `DaySky` and `NightSky` move to the engine.

- [#1125](https://github.com/JollyPixel/editor/pull/1125) [`a61b2a3`](https://github.com/JollyPixel/editor/commit/a61b2a318638f4f644b0ad2870f2c69071e50bfc) Thanks [@fraxken](https://github.com/fraxken)! - Add an `anchor` flag to layers and voxel objects, saved with the world. `VoxelMapDefinition.anchors()` publishes the flagged ones as scene anchors through `VoxelMapAnchors`.

- [#1096](https://github.com/JollyPixel/editor/pull/1096) [`0ac751d`](https://github.com/JollyPixel/editor/commit/0ac751d6b077948c497ba62b9851eb222a516b7e) Thanks [@fraxken](https://github.com/fraxken)! - Add `VoxelMapDefinition`, the `VoxelMap` scene-file component type, with its `VOXEL_MAP_ASSET` slot type and `VoxelMapSource` interface.
  A map with `collision` on gets the colliders of the definition's `collider` option in play mode.

### Patch Changes

- [#1125](https://github.com/JollyPixel/editor/pull/1125) [`8e19cb6`](https://github.com/JollyPixel/editor/commit/8e19cb64ff52d4fc1ea5ef969bb65ef74b918e06) Thanks [@fraxken](https://github.com/fraxken)! - `PulledChunkGeometry.computeBoundingBox()` and `computeBoundingSphere()` keep the chunk's cell bounds instead of measuring the template quad, so bounding-box highlights and raycasts stay correct after a recompute.

- [#1232](https://github.com/JollyPixel/editor/pull/1232) [`70b0e15`](https://github.com/JollyPixel/editor/commit/70b0e15d612fa6f9720d81af22e743f51eeebff2) Thanks [@fraxken](https://github.com/fraxken)! - Update three.js to 0.187.0.
  `BakedRoomEnvironment` now bakes a 64 pixel PMREM cube with 4 mip levels, and `createRenderTarget` returns a `CubeRenderTarget` (generated on the WebGL 2 fallback).

- [#1239](https://github.com/JollyPixel/editor/pull/1239) [`9e5a641`](https://github.com/JollyPixel/editor/commit/9e5a641a1b55e6248cb0ed5c39eab2b188a48bd2) Thanks [@fraxken](https://github.com/fraxken)! - `PhysicsVoxelCollider` takes a `placement` matrix so chunk bodies follow a moved, rotated or scaled map actor.
  `blocksFromTileGrid` now generates collidable blocks by default.

- [#1280](https://github.com/JollyPixel/editor/pull/1280) [`e88d8ce`](https://github.com/JollyPixel/editor/commit/e88d8ce39fac486a6b6441d508c1736684430223) Thanks [@fraxken](https://github.com/fraxken)! - `VoxelDocument` and `VoxelView` log under the `voxel.document` and `voxel.view` namespaces.

- [#1252](https://github.com/JollyPixel/editor/pull/1252) [`0e36645`](https://github.com/JollyPixel/editor/commit/0e3664584b60d712bed3e7bdf0cf4ad5df746732) Thanks [@fraxken](https://github.com/fraxken)! - Vertex-pulled faces sample their AO, light and blend inputs at the centroid and clamp them, so faces seen edge-on no longer draw a bright 1px line under MSAA. Chunk texture nodes stop logging "Abstract function." every frame.
- Updated dependencies [[`ec79d3f`](https://github.com/JollyPixel/editor/commit/ec79d3f32c41f9c43ea81271e805fe48416e1d6a), [`5b2019f`](https://github.com/JollyPixel/editor/commit/5b2019f7ae2624255c6c2ac3ea510fe817005ac0), [`b7d2f82`](https://github.com/JollyPixel/editor/commit/b7d2f8249cb29ac71e78cb7e92730a2d818d567f), [`5494a67`](https://github.com/JollyPixel/editor/commit/5494a67d7495071378b5eae430d51ef034cb5c35), [`dc99a29`](https://github.com/JollyPixel/editor/commit/dc99a2924185d97da740f597eb3b79de323a566b), [`f7572a4`](https://github.com/JollyPixel/editor/commit/f7572a4db2e9219c4fda9dc67277c16162e68b52), [`c9f075a`](https://github.com/JollyPixel/editor/commit/c9f075a25e55927134b0b2f649a3c1178f06d61b), [`cd88847`](https://github.com/JollyPixel/editor/commit/cd88847e7a7c8005a36c785768eeae6132e46e60), [`b8d702d`](https://github.com/JollyPixel/editor/commit/b8d702d7da9e919b194ad25bdbca76aa86c95311), [`7d7aa9c`](https://github.com/JollyPixel/editor/commit/7d7aa9cedaf294a4fddfc03b166e575e8f3c9140), [`70b0e15`](https://github.com/JollyPixel/editor/commit/70b0e15d612fa6f9720d81af22e743f51eeebff2)]:
  - @jolly-pixel/asset@5.0.0
  - @jolly-pixel/physics@2.0.0
  - @jolly-pixel/backend.three@1.0.1
  - @jolly-pixel/ecs@1.0.1

## 8.0.0

### Major Changes

- [#924](https://github.com/JollyPixel/editor/pull/924) [`f174add`](https://github.com/JollyPixel/editor/commit/f174addea4b885bd601976b7fd730a91a0b047c4) Thanks [@fraxken](https://github.com/fraxken)! - `CommandDocument`, `ChangeReceipts` and `CommandHistory` move to the new `@jolly-pixel/history` package. The renderers no longer own undo: `PixelArtCanvas` takes a history from the host, and `VoxelHistory` is removed.

- [#907](https://github.com/JollyPixel/editor/pull/907) [`1573449`](https://github.com/JollyPixel/editor/commit/1573449ce827112ccae3d23c6ce236fc97e2041e) Thanks [@fraxken](https://github.com/fraxken)! - Rename tilesets to blocksets across the API and world format (`VOXEL_WORLD_VERSION` 5); older worlds are rejected.

- [#959](https://github.com/JollyPixel/editor/pull/959) [`7211095`](https://github.com/JollyPixel/editor/commit/7211095861cc3627cee5c40eb016353e52ae5f54) Thanks [@fraxken](https://github.com/fraxken)! - Rename ambiguous factories, lookups, conversions, and updates to describe their intent.
  Update callers using the API name migration guide; saved voxel data is unchanged.

- [#872](https://github.com/JollyPixel/editor/pull/872) [`9153958`](https://github.com/JollyPixel/editor/commit/91539588561132385e6fe1071f629939693bdc59) Thanks [@fraxken](https://github.com/fraxken)! - Stop exporting internal types such as `VoxelStore` and `MeshBuildStats`.

### Minor Changes

- [#915](https://github.com/JollyPixel/editor/pull/915) [`a582ec5`](https://github.com/JollyPixel/editor/commit/a582ec518947b99eb3c0d08ee5c9608bd0281b8d) Thanks [@fraxken](https://github.com/fraxken)! - Add the `material-group-renamed` blockset command, applied by `BlocksetDocument.renameMaterialGroup()` and `BlocksetLink.renameMaterialGroup()`: it moves a group's finish and every block naming it to the new id in one command.

- [#951](https://github.com/JollyPixel/editor/pull/951) [`86af3d5`](https://github.com/JollyPixel/editor/commit/86af3d5b5e2fcc0ca9db56460add568776bde5eb) Thanks [@fraxken](https://github.com/fraxken)! - Support KTX2 compressed textures: the `texture` kind claims `.ktx2`, and `Runtime` builds a loader from `assets.ktx2.transcoderPath`.

- [#916](https://github.com/JollyPixel/editor/pull/916) [`8f704d3`](https://github.com/JollyPixel/editor/commit/8f704d30544b4203fe5c6303da3c5913b48924e2) Thanks [@fraxken](https://github.com/fraxken)! - Add an optional `swatch` colour to `MaterialGroup`, a label colour for editors that is not rendered. `with()` now takes `MaterialGroupChanges`, which covers it.

- [#862](https://github.com/JollyPixel/editor/pull/862) [`5563478`](https://github.com/JollyPixel/editor/commit/55634788aa98ea5616d9b2e3c58c3f6987b94f19) Thanks [@fraxken](https://github.com/fraxken)! - Add normal maps: pixel-draw derives a synced, undoable normal map per UV island, and voxel-renderer lights blocksets with it, scaled by `MaterialGroup.normalScale`.

- [#917](https://github.com/JollyPixel/editor/pull/917) [`deaf77f`](https://github.com/JollyPixel/editor/commit/deaf77f2cdd8ecd8e24602c0014efd17672617c0) Thanks [@fraxken](https://github.com/fraxken)! - `ThreeRenderer` reports a lost device, the model loader decodes Meshopt glTF, and `VoxelView.meshVersion` lets a host keep a static shadow map.

- [#917](https://github.com/JollyPixel/editor/pull/917) [`51a51c6`](https://github.com/JollyPixel/editor/commit/51a51c6e8349436143c5fd6b5a58947826f0106c) Thanks [@fraxken](https://github.com/fraxken)! - Add block light: a material group's `lightLevel` (0-15) lights nearby blocks in its emissive hue. Emission now tints the block texture instead of painting a flat colour.

- [#905](https://github.com/JollyPixel/editor/pull/905) [`26b8b55`](https://github.com/JollyPixel/editor/commit/26b8b551d00aa70ea11b7b7e0097f70c1da43dc3) Thanks [@fraxken](https://github.com/fraxken)! - `"block-defined"` commands say what changed through `redefinition`, so a `name` or `properties` change no longer remeshes the world.

- [#901](https://github.com/JollyPixel/editor/pull/901) [`3dc4f6b`](https://github.com/JollyPixel/editor/commit/3dc4f6b545d6b9429f53923c1bfdcedbdf70cc7d) Thanks [@fraxken](https://github.com/fraxken)! - Add built-in shapes: `Slab` beam/corner/notch (stair complements), `rampTip`, `rampValley`, `stairCornerPeak`, `Wall` joints, and `Pole` joints with an optional vertical rise (`new Pole(type, rise)`).
  `pole` and `poleY` now collide as boxes.

- [#1035](https://github.com/JollyPixel/editor/pull/1035) [`7a17c6c`](https://github.com/JollyPixel/editor/commit/7a17c6c7055665e60224ea4561915841b4e4d495) Thanks [@fraxken](https://github.com/fraxken)! - `world.addLayer()` takes an optional `id` (`VoxelLayerAddOptions`). An id already in use adds nothing and returns that layer.
  `VoxelTemplate.sameVoxels()` compares the voxels of two templates.

- [#920](https://github.com/JollyPixel/editor/pull/920) [`81c2b1b`](https://github.com/JollyPixel/editor/commit/81c2b1b5f6638dc2735b6bef8e65b5bbc39a917e) Thanks [@fraxken](https://github.com/fraxken)! - Add `VoxelChunk.contentBounds()`; layer bounds now rescan only edited chunks after an edit.

- [#901](https://github.com/JollyPixel/editor/pull/901) [`fb40cb1`](https://github.com/JollyPixel/editor/commit/fb40cb1c046689078e3e1f1efebc938bbf6831a6) Thanks [@fraxken](https://github.com/fraxken)! - Two complementary shapes can share one cell (`setVoxel({ merge: true })`), saved and synced with the world. Voxel tuples now carry the partner as a fifth element.

- [#993](https://github.com/JollyPixel/editor/pull/993) [`c50850d`](https://github.com/JollyPixel/editor/commit/c50850def42ecdba29160a5531d0f81113e4e44b) Thanks [@fraxken](https://github.com/fraxken)! - Add `VoxelTemplates.createFromSnapshot()`, which saves a template built outside the world (such as a turned copy of a selection) under a new name and id.

### Patch Changes

- [#901](https://github.com/JollyPixel/editor/pull/901) [`59879f7`](https://github.com/JollyPixel/editor/commit/59879f705d6e524ce424f09cb3cc26065f81056e) Thanks [@fraxken](https://github.com/fraxken)! - Faster chunk meshing with the same output, and less memory: smaller face textures, shared chunk attributes, and colliders built only when used.

- [#1003](https://github.com/JollyPixel/editor/pull/1003) [`ebe2efd`](https://github.com/JollyPixel/editor/commit/ebe2efda62b91bec7c92472c67e54b263414eeb7) Thanks [@fraxken](https://github.com/fraxken)! - Chunk materials cast shadows from the faces they show (`shadowSide` follows `side`), so filtered shadows no longer leak light into inner corners.
  Lights may need a `shadow.normalBias` of one to two shadow-map texels to keep lit faces free of acne.

- [#901](https://github.com/JollyPixel/editor/pull/901) [`2447d5c`](https://github.com/JollyPixel/editor/commit/2447d5c122a91cde0a3a1bc4416adfbbd2c37585) Thanks [@fraxken](https://github.com/fraxken)! - Moving a block's tiles or renaming it no longer remeshes any chunk.
- Updated dependencies [[`32d05ac`](https://github.com/JollyPixel/editor/commit/32d05acf969fc7b09067ffcda2fcea0e6191fbcd), [`02b3191`](https://github.com/JollyPixel/editor/commit/02b3191adf3f5b2dbc5df5e8768d5434ae3b0351), [`d225112`](https://github.com/JollyPixel/editor/commit/d2251127dac7d6b2ca8f4bf123331062156d645f), [`c9726dc`](https://github.com/JollyPixel/editor/commit/c9726dc516927b5d119e066e7dfa0a1bca536eaf), [`e5178c2`](https://github.com/JollyPixel/editor/commit/e5178c28b3650f6edddc97208f0f31168f628768), [`48dd303`](https://github.com/JollyPixel/editor/commit/48dd3038b36246492b62bdd6e71137dd1d3d9c3e), [`98cbd2b`](https://github.com/JollyPixel/editor/commit/98cbd2b36acf3752a62d18a2bb5b6c8a505cc311), [`86af3d5`](https://github.com/JollyPixel/editor/commit/86af3d5b5e2fcc0ca9db56460add568776bde5eb), [`5f66fe9`](https://github.com/JollyPixel/editor/commit/5f66fe99d7d1b7cb1df7c1383f2fa60ba6acf6cd), [`bc29b43`](https://github.com/JollyPixel/editor/commit/bc29b4307c5a3b485f6b2006c11f4a832b73284b), [`0436e3c`](https://github.com/JollyPixel/editor/commit/0436e3c645a2d717b90bb407ce41eb412beb4943), [`695ee81`](https://github.com/JollyPixel/editor/commit/695ee81072bd90cae25c03e5e850ce214153278b), [`33f6b2f`](https://github.com/JollyPixel/editor/commit/33f6b2f3a7c5ced091a3500480fbd2160f5ffcc0), [`e1e86cb`](https://github.com/JollyPixel/editor/commit/e1e86cb232b5e021d839a58b8b68013194308349), [`deaf77f`](https://github.com/JollyPixel/editor/commit/deaf77f2cdd8ecd8e24602c0014efd17672617c0), [`51c9b58`](https://github.com/JollyPixel/editor/commit/51c9b58a6d5d6f279413d82be26c9d92609905c9)]:
  - @jolly-pixel/engine@7.1.0

## 7.0.0

### Major Changes

- [#789](https://github.com/JollyPixel/editor/pull/789) [`b520e7e`](https://github.com/JollyPixel/editor/commit/b520e7e37c000763a492f68635af528ca461a285) Thanks [@fraxken](https://github.com/fraxken)! - Package subpaths follow one naming scheme (`/node`, `/client`, `/browser`), and every package declares `exports`; for example, import `event-store/node` instead of `event-store/sqlite`. Package roots are browser-safe.

- [#783](https://github.com/JollyPixel/editor/pull/783) [`a0babe5`](https://github.com/JollyPixel/editor/commit/a0babe519d6b1607cd8a8f0be9aa607d76a3643a) Thanks [@fraxken](https://github.com/fraxken)! - Opaque layers on the chunk grid share one mesh per chunk, so stacking layers no longer multiplies draw calls. `VoxelChunkCollision` carries `origin` and `chunks` instead of `chunk` and `layerPosition`.

- [#806](https://github.com/JollyPixel/editor/pull/806) [`cacd3a0`](https://github.com/JollyPixel/editor/commit/cacd3a08518e69fdaf8d3bae826590dc83699d16) Thanks [@fraxken](https://github.com/fraxken)! - Remove layer opacity: a `VoxelLayer` is either visible or hidden, and translucency comes from the block `alphaMode`.
  `setLayerOpacity()`, `VoxelLayer.opacity` and `effectivelyVisible` are gone, and world documents no longer store a layer `opacity`.

- [#803](https://github.com/JollyPixel/editor/pull/803) [`ab4ad1a`](https://github.com/JollyPixel/editor/commit/ab4ad1a00b61463b39aaaae73644ca329898b8de) Thanks [@fraxken](https://github.com/fraxken)! - Remove `VoxelEngine`: `VoxelRenderer` exposes `document` and `view`, and greedy meshing is replaced by vertex pulling with optional Web Worker meshing. GPU memory is now reported in the metrics.

- [#810](https://github.com/JollyPixel/editor/pull/810) [`702c030`](https://github.com/JollyPixel/editor/commit/702c030e3931f06f687f5d25fd3a76b1a251acb0) Thanks [@fraxken](https://github.com/fraxken)! - Replace the tileset projection helpers with `TilesetSlot` and a live `TilesetLink`, and `VoxelWorld.setLayerVisible()` with the per-view `view.layerVisibility`. Add `BlockPieces` and template placement helpers.

- [#787](https://github.com/JollyPixel/editor/pull/787) [`ea7d617`](https://github.com/JollyPixel/editor/commit/ea7d61731146bedcacdb28a18998234209e11a4f) Thanks [@fraxken](https://github.com/fraxken)! - World documents move to version 2: blocks, material groups and tile size live in `TilesetDocument`, and worlds link tilesets. Tiled import moves out of the package.

- [#791](https://github.com/JollyPixel/editor/pull/791) [`b4574c7`](https://github.com/JollyPixel/editor/commit/b4574c71334e5c21b871d66785348f67c1407744) Thanks [@fraxken](https://github.com/fraxken)! - Replace `VoxelTransparencyRenderer` with `VoxelTransparencyPassNode` (`voxelTransparencyPass()`), a `PassNode` that resolves weighted blended transparency as a TSL node, so it can be a camera's post-processing output and feed further effects.

- [#805](https://github.com/JollyPixel/editor/pull/805) [`434578c`](https://github.com/JollyPixel/editor/commit/434578c654e30e9eb477a5fb9ee8bf417a46de32) Thanks [@fraxken](https://github.com/fraxken)! - World documents move to version 3, storing chunks run-length encoded: about 10x smaller and 50x faster to load. Version 2 worlds are rejected.

### Minor Changes

- [#845](https://github.com/JollyPixel/editor/pull/845) [`399e1e4`](https://github.com/JollyPixel/editor/commit/399e1e448a7cab33990ccb000c381ec266060de5) Thanks [@fraxken](https://github.com/fraxken)! - Add `renderOnDemand` to `Runtime`: the loop sleeps when nothing changes, and cameras, voxel views and peer syncs request the frames they need. Room joins load a much smaller snapshot.

- [#823](https://github.com/JollyPixel/editor/pull/823) [`1bbae1c`](https://github.com/JollyPixel/editor/commit/1bbae1ceddffa7431cbe9c711d41a3c401a5dc93) Thanks [@fraxken](https://github.com/fraxken)! - Clients reconnect with backoff and resume their rooms where they left off, rebasing pending local changes. Voxel layers are addressed by `layerId` (world format v4).

- [#780](https://github.com/JollyPixel/editor/pull/780) [`ee952e8`](https://github.com/JollyPixel/editor/commit/ee952e852ed121b8a965fc0287c96b90353b4eee) Thanks [@fraxken](https://github.com/fraxken)! - `VoxelWorld.apply()` returns the layer command as applied, or `null` for a no-op, so `engine.apply()` no longer reports or broadcasts layer commands that changed nothing.

- [#779](https://github.com/JollyPixel/editor/pull/779) [`893b77b`](https://github.com/JollyPixel/editor/commit/893b77b7b7787a85f5a151387bb9856405ecb2de) Thanks [@fraxken](https://github.com/fraxken)! - `deserializeVoxelWorld` no longer rejects a document saved with another `chunkSize`: its voxels are re-partitioned into the target world's chunks.

- [#771](https://github.com/JollyPixel/editor/pull/771) [`91fcd4b`](https://github.com/JollyPixel/editor/commit/91fcd4b16a3c1fc800a61328e8f08c5c34b6c72f) Thanks [@fraxken](https://github.com/fraxken)! - Type `faceTextures` keys with the exported `FaceSlotName` and `TextureSlotKey`, and log a warning when a key matches no slot of the block's shape.

- [#779](https://github.com/JollyPixel/editor/pull/779) [`11177cc`](https://github.com/JollyPixel/editor/commit/11177cc63b6a122878b5a1f08b08792c2de9cd37) Thanks [@fraxken](https://github.com/fraxken)! - Store material group finishes (roughness, metalness, emissive) in the document through `materialGroups` and the new `material-group-*` commands. A defined group renders with a standard material even in a Lambert view.

- [#771](https://github.com/JollyPixel/editor/pull/771) [`9c5ca7e`](https://github.com/JollyPixel/editor/commit/9c5ca7ea2d42626d34bd880b3bc3d9e019d83566) Thanks [@fraxken](https://github.com/fraxken)! - Add a `materialGroup` block surface option: grouped blocks get their own chunk material on a shared atlas, and `materialCustomizer` reads it from `surface.materialGroup`.

- [#807](https://github.com/JollyPixel/editor/pull/807) [`3f464c9`](https://github.com/JollyPixel/editor/commit/3f464c9628bedc28aad4f66ffc8cc3506c0d21f2) Thanks [@fraxken](https://github.com/fraxken)! - `mergeLayers` and `world.mergeAllLayers()` accept `{ except }` to keep named layers apart; `mergeAllLayers()` returns the resulting layers.

- [#807](https://github.com/JollyPixel/editor/pull/807) [`38f1f4c`](https://github.com/JollyPixel/editor/commit/38f1f4c85b14c30ad98cf30c3b2cf3b3dc6c02f8) Thanks [@fraxken](https://github.com/fraxken)! - Add voxel templates: save groups of voxels with the world and place them into a layer, turned or mirrored, as one undoable step. Add `world.transformLayer()`.

- [#807](https://github.com/JollyPixel/editor/pull/807) [`b074c56`](https://github.com/JollyPixel/editor/commit/b074c56410ae2ac64da0510137005042a3ead13a) Thanks [@fraxken](https://github.com/fraxken)! - Add blend groups: `BlockDefinition.blendGroup` fades the top and bottom faces of blocks into their neighbours along a wavy or dithered border.

- [#771](https://github.com/JollyPixel/editor/pull/771) [`d7df794`](https://github.com/JollyPixel/editor/commit/d7df7946c24dce266a26e7dc8050c680145590b8) Thanks [@fraxken](https://github.com/fraxken)! - Add `VoxelWorld.transaction()` for bulk writes recorded as one undo step, and `patchVoxels()`, the fastest way to write generated worlds.

### Patch Changes

- [#812](https://github.com/JollyPixel/editor/pull/812) [`dbc4a65`](https://github.com/JollyPixel/editor/commit/dbc4a65bab4bc74413d56bdd0097c227b88f2e8e) Thanks [@fraxken](https://github.com/fraxken)! - Redefining a block remeshes only the chunks holding it (and their neighbours when its shape, occlusion, culling or blend group changed) instead of the whole world.
  Chunk materials no longer used stay compiled for reuse, up to sixteen.

- [#795](https://github.com/JollyPixel/editor/pull/795) [`46e2190`](https://github.com/JollyPixel/editor/commit/46e2190471cf756d8686361cdca4068d9b78de6c) Thanks [@fraxken](https://github.com/fraxken)! - Cheaper shadow maps: chunk materials cast with a lean color graph (no atlas filtering or ambient occlusion for opaque surfaces) and pulled chunks with a position-only vertex stage. Pulled faces draw as indexed quads.
- Updated dependencies [[`6e6ca8b`](https://github.com/JollyPixel/editor/commit/6e6ca8b6aa3be1af5f4cf35b6e18f8de261712db), [`e606d65`](https://github.com/JollyPixel/editor/commit/e606d657b056d1e20f04a30f8cb2305f19fe9865), [`bd7b3d3`](https://github.com/JollyPixel/editor/commit/bd7b3d3c346826673e9de8d14286a8573c253fe1), [`399e1e4`](https://github.com/JollyPixel/editor/commit/399e1e448a7cab33990ccb000c381ec266060de5), [`175845f`](https://github.com/JollyPixel/editor/commit/175845ff00ccac8ae8a81472543feb5345b6f2a1), [`46ea926`](https://github.com/JollyPixel/editor/commit/46ea926b7946125a538f7bb885a5a8e0788f9418), [`e7383a4`](https://github.com/JollyPixel/editor/commit/e7383a4b93414ca3334f8ff9440f9da8fd8c2279), [`b520e7e`](https://github.com/JollyPixel/editor/commit/b520e7e37c000763a492f68635af528ca461a285)]:
  - @jolly-pixel/engine@7.0.0

## 6.0.0

### Major Changes

- [#725](https://github.com/JollyPixel/editor/pull/725) [`9e4b7a1`](https://github.com/JollyPixel/editor/commit/9e4b7a16d5348458027d06eafc68baf51ca4f519) Thanks [@fraxken](https://github.com/fraxken)! - Track dependencies between assets in the catalog. Tilesets can point at a pixel-art `asset`, and several `PixelArtCanvas` can share one headless `PixelDocument`.

- [#712](https://github.com/JollyPixel/editor/pull/712) [`b2f9c84`](https://github.com/JollyPixel/editor/commit/b2f9c84847533ea970260c7f86a4b41fc0084023) Thanks [@fraxken](https://github.com/fraxken)! - Rename `BlockDefinition.cullSelfFaces` to `cullCoveredFaces`, now `false` by
  default for mask and blend blocks. When `false`, a double-sided block also
  keeps the faces an opaque neighbour covers.

- [#717](https://github.com/JollyPixel/editor/pull/717) [`9ddfefa`](https://github.com/JollyPixel/editor/commit/9ddfefa06a3f0d3b9e334184d08c611056b87290) Thanks [@fraxken](https://github.com/fraxken)! - Faster meshing and leaner chunk geometry. Rapier colliders merge cubes into cuboids, size slabs correctly and build trimeshes from shape faces.

### Minor Changes

- [#765](https://github.com/JollyPixel/editor/pull/765) [`f92e245`](https://github.com/JollyPixel/editor/commit/f92e2453211663158b04606da2008ba25cc35529) Thanks [@fraxken](https://github.com/fraxken)! - Add `Runtime.nextFrame()`/`frames(count)`, `VoxelEngine.whenIdle()`, `projectToClient()` in three,
  and `textureClientPosition()` on the pixel-draw canvas viewport (typed `CanvasViewport`).

- [#731](https://github.com/JollyPixel/editor/pull/731) [`9b5942f`](https://github.com/JollyPixel/editor/commit/9b5942ff723494fab75046415884b5e700a58072) Thanks [@fraxken](https://github.com/fraxken)! - Blocks of a removed tileset draw with a red missing-tileset texture instead of disappearing, and blocks waiting for their texture no longer leave holes in the mesh.

- [#719](https://github.com/JollyPixel/editor/pull/719) [`3fa7340`](https://github.com/JollyPixel/editor/commit/3fa7340724862619d60dc63df0564a2e87333ae2) Thanks [@fraxken](https://github.com/fraxken)! - A ramp slope with its own tile now samples its true `√2` length (16 by 23 texels on 16-texel tiles) through the new `TileSpan`; shared `defaultTexture` tiles stay square.
  `UVSlotGeometryTemplate` accepts a per-slot `width` and `height`.

- [#748](https://github.com/JollyPixel/editor/pull/748) [`54c361c`](https://github.com/JollyPixel/editor/commit/54c361c02b8f7ddf26cf71e0453f8f224566cffc) Thanks [@fraxken](https://github.com/fraxken)! - Own performance metrics in the runtime: a subsystem describes what it counts
  through the structural `MetricSource`, `runtime.metrics` registers it on one
  recorder, and `mountMetricsPanel()` builds a dockable readout from them.

- [#716](https://github.com/JollyPixel/editor/pull/716) [`3419b6f`](https://github.com/JollyPixel/editor/commit/3419b6ff79ca0afd1bbcbb3b4e27c90669347e3e) Thanks [@fraxken](https://github.com/fraxken)! - `buildShapeGeometry()` accepts an optional `VoxelTransform` and returns the geometry oriented
  like the chunk mesher places it (rotation, flips, flipY winding).

- [#716](https://github.com/JollyPixel/editor/pull/716) [`b096df1`](https://github.com/JollyPixel/editor/commit/b096df1a835aed2b8c2f0dc1eb24d5f9940bbf5d) Thanks [@fraxken](https://github.com/fraxken)! - Multisample the `VoxelTransparencyRenderer` offscreen targets, so scenes drawn
  through the compositor are antialiased again. The new `samples` option
  (default 4) sets the MSAA level; 0 disables it.

- [#721](https://github.com/JollyPixel/editor/pull/721) [`710542c`](https://github.com/JollyPixel/editor/commit/710542c574f803f405bec2b5d9270b5f4e83898d) Thanks [@fraxken](https://github.com/fraxken)! - UV regions can be rotated by 90° (`UVMap.rotate()`, `R`/`Shift+R`), and `ResolvedTileRef.rotation` turns a tile inside its face.

- [#713](https://github.com/JollyPixel/editor/pull/713) [`4ae4d68`](https://github.com/JollyPixel/editor/commit/4ae4d683df8328d306023260732c1efc787acd98) Thanks [@fraxken](https://github.com/fraxken)! - Add optional `VoxelHistory` undo/redo of voxel edits (`engine.history`, disabled by default, 10 entries),
  with `begin()`/`commit()` grouping and replay that keeps cells a peer changed since.

- [#755](https://github.com/JollyPixel/editor/pull/755) [`32471c1`](https://github.com/JollyPixel/editor/commit/32471c172bcc5104c27b8a9b26f1c956f23a360a) Thanks [@fraxken](https://github.com/fraxken)! - Split `VoxelEngine` into a headless `VoxelDocument` and a `VoxelView` that draws it; `VoxelEngine` accepts an existing `document`.

### Patch Changes

- [#712](https://github.com/JollyPixel/editor/pull/712) [`3921dca`](https://github.com/JollyPixel/editor/commit/3921dca419e4b559c19a01bb4a03f03265e0234e) Thanks [@fraxken](https://github.com/fraxken)! - Rebuild the `VoxelTransparencyRenderer` resolve pass when the renderer's tone
  mapping or output color space changes, so runtime switches take effect.

- [#739](https://github.com/JollyPixel/editor/pull/739) [`f7b4ec2`](https://github.com/JollyPixel/editor/commit/f7b4ec2fea370220bba2d2ca68f0cb570ed80fcf) Thanks [@fraxken](https://github.com/fraxken)! - `VoxelTransparencyRenderer` waits for the canvas size to settle before
  reallocating its offscreen targets, removing the FPS drop of a live resize.

- [#718](https://github.com/JollyPixel/editor/pull/718) [`766b301`](https://github.com/JollyPixel/editor/commit/766b301fde0dcc651588e8bcefc5bf52707c5780) Thanks [@fraxken](https://github.com/fraxken)! - Cull partial boundary faces, such as ramp and stair sides, that an opaque neighbour covers entirely.
  Fix `flipX`/`flipZ` voxels culling the wrong sides and rendering their faces with an inverted winding.
- Updated dependencies [[`9e4b7a1`](https://github.com/JollyPixel/editor/commit/9e4b7a16d5348458027d06eafc68baf51ca4f519), [`0bbc913`](https://github.com/JollyPixel/editor/commit/0bbc91316d992bd0e23609df326632efd1cc7d82), [`3b91a42`](https://github.com/JollyPixel/editor/commit/3b91a42d560941a003b777f57060fe18972dc4c8)]:
  - @jolly-pixel/asset@2.1.0
  - @jolly-pixel/engine@6.0.0

## 5.0.0

### Major Changes

- [#689](https://github.com/JollyPixel/editor/pull/689) [`81f9fcc`](https://github.com/JollyPixel/editor/commit/81f9fcc003a62bb102e5f0cfb4cf439165778ccf) Thanks [@fraxken](https://github.com/fraxken)! - Tilesets are declared on the world (`engine.tilesets`), and `VoxelEngine` emits one `"command"` event that replaces the per-change callbacks. Add the browser `CatalogClient`.

- [#639](https://github.com/JollyPixel/editor/pull/639) [`55a1230`](https://github.com/JollyPixel/editor/commit/55a12309b7e3d4a3c7ba7efc47766655abaf10f9) Thanks [@fraxken](https://github.com/fraxken)! - Authenticate connections at the WebSocket handshake through an `AuthenticationProvider`. The client's `identity` becomes the untrusted `profile`, and roles missing from a rights table are denied.

- [#693](https://github.com/JollyPixel/editor/pull/693) [`6895753`](https://github.com/JollyPixel/editor/commit/6895753c6e09c43758357ee5997b981ce5c401ac) Thanks [@fraxken](https://github.com/fraxken)! - Rename `VoxelDebugger` to `VoxelInspector` (`engine.inspector`) and add block statistics such as `countBlocks()`. `jolly-tree` gains `TreeNode.detail` for muted trailing text.

- [#657](https://github.com/JollyPixel/editor/pull/657) [`725fbf7`](https://github.com/JollyPixel/editor/commit/725fbf7c0f8f803eb667ff1b7cef17275a0a52fe) Thanks [@fraxken](https://github.com/fraxken)! - Replace voxel-layer offsets with world-space positions and serialize voxel keys in layer-local space.
  Add coordinate conversion, bounds, center, and origin-rebasing APIs.

- [#661](https://github.com/JollyPixel/editor/pull/661) [`6bd582e`](https://github.com/JollyPixel/editor/commit/6bd582e59fff4dc04c8f987fbbf9da51376be6a2) Thanks [@fraxken](https://github.com/fraxken)! - Move voxel-map persistence and collaboration to `@jolly-pixel/asset.voxel-map` and remove the `/asset` and `/network` exports. `VoxelRenderer` and `TiledMapAssetLoader` move to their own entry points.

- [#692](https://github.com/JollyPixel/editor/pull/692) [`8431307`](https://github.com/JollyPixel/editor/commit/8431307c65ec6f3cb54e9abd201f43f9a0b16e25) Thanks [@fraxken](https://github.com/fraxken)! - Remove atlas padding and the tile rescale helpers, and add the `BlockTextures` value object, which replaces `tileRefForSlot`, `blockTileRefs` and related helpers.

### Minor Changes

- [#643](https://github.com/JollyPixel/editor/pull/643) [`c22f8a9`](https://github.com/JollyPixel/editor/commit/c22f8a9407ac534117ce8f74e61d454d721c0044) Thanks [@fraxken](https://github.com/fraxken)! - Make the block table's order editable and durable. `BlockRegistry.moveTo()`
  relocates a definition, `VoxelEngine.moveBlock()` emits it as a new
  `block-moved` hook and network command, and the document's `blocks` array
  round trips that order.

- [#641](https://github.com/JollyPixel/editor/pull/641) [`4029a4d`](https://github.com/JollyPixel/editor/commit/4029a4d9da915a4b191a00cad2a92e0d2fe8f544) Thanks [@fraxken](https://github.com/fraxken)! - Transparent blocks blend partial alpha instead of rendering it solid. Add `BlockDefinition.cullSelfFaces` to keep the face two voxels of the same transparent block share.

- [#638](https://github.com/JollyPixel/editor/pull/638) [`5596bfb`](https://github.com/JollyPixel/editor/commit/5596bfb3d6151ff7b320f2bde32befc2f497d857) Thanks [@fraxken](https://github.com/fraxken)! - Blocks can carry game `properties`, read with `BlockRegistry.propertiesOf()` or by position with `VoxelEngine.blockAt()` and `blockPropertiesAt()`.

### Patch Changes

- [#659](https://github.com/JollyPixel/editor/pull/659) [`853c83b`](https://github.com/JollyPixel/editor/commit/853c83b9070a249087dab57247bc8dad0605b781) Thanks [@fraxken](https://github.com/fraxken)! - Remove the unused `sync`, `catalog`, `rooms`, `static` and `workspace` subpath exports; import from the package root instead.
  Add a `kinds` entry exposing the asset kind handler contract, used by the renderer asset handlers.

- [#699](https://github.com/JollyPixel/editor/pull/699) [`9f5cb54`](https://github.com/JollyPixel/editor/commit/9f5cb5412ba47200793de247e3de53e21e8b7ec4) Thanks [@fraxken](https://github.com/fraxken)! - Update three.js to 0.186.0.
  `disposeObject3D` now ignores the base `Object3D.dispose` added in 0.186, so a plain mesh's geometry and material are freed again.
  `snapValue` normalizes a negative zero result to positive zero.
- Updated dependencies [[`b91d177`](https://github.com/JollyPixel/editor/commit/b91d1777197a160daafd69ed4857ff9ea3c999c4), [`81f9fcc`](https://github.com/JollyPixel/editor/commit/81f9fcc003a62bb102e5f0cfb4cf439165778ccf), [`bd77308`](https://github.com/JollyPixel/editor/commit/bd773087b83d357491bd56e0e3d60808f2ee5434), [`9f5cb54`](https://github.com/JollyPixel/editor/commit/9f5cb5412ba47200793de247e3de53e21e8b7ec4)]:
  - @jolly-pixel/engine@5.1.0
  - @jolly-pixel/asset@2.0.0

## 4.0.0

### Major Changes

- [#618](https://github.com/JollyPixel/editor/pull/618) [`d6b2a37`](https://github.com/JollyPixel/editor/commit/d6b2a37da51adcbfc84267c5276958299f58eb7b) Thanks [@fraxken](https://github.com/fraxken)! - Asset kinds describe a declarative `live()` protocol instead of a room extension; `PixelArtAssetExtension` and `VoxelMapAssetExtension` are removed.

- [#546](https://github.com/JollyPixel/editor/pull/546) [`a865770`](https://github.com/JollyPixel/editor/commit/a865770108f0a79438a3b48f4f42267a637525f5) Thanks [@fraxken](https://github.com/fraxken)! - Add the `VoxelTransform`, `AtlasLayout`, `VoxelFootprint` and `ChunkGeometryKey` value objects; they replace `packTransform()`, `unpackTransform()`, `normalizeVoxelExtent()` and `voxelObjectFootprint()`.

- [#541](https://github.com/JollyPixel/editor/pull/541) [`3a0c3e5`](https://github.com/JollyPixel/editor/commit/3a0c3e55d59e2252a8112c8df76072ad95b88ae5) Thanks [@fraxken](https://github.com/fraxken)! - `packVoxel()` throws on air (block id 0) and `BlockRegistry` rejects an air definition. Export `AIR_BLOCK_ID` and `isAir()`.

- [#580](https://github.com/JollyPixel/editor/pull/580) [`8840d6e`](https://github.com/JollyPixel/editor/commit/8840d6ea92beb5ce75fe620422590d74ebc4f40c) Thanks [@fraxken](https://github.com/fraxken)! - Flip the meaning of `VoxelWorld.moveLayer()` directions: `"up"` now raises a
  layer's compositing priority and `"down"` lowers it. The voxel-map layer tree
  lists layers highest priority first, so the layer on top renders on top.

- [#581](https://github.com/JollyPixel/editor/pull/581) [`3606760`](https://github.com/JollyPixel/editor/commit/360676096137146945381e2a0ace6597bad45ecd) Thanks [@fraxken](https://github.com/fraxken)! - `VoxelCommandArbiter.resolve()` is replaced by `admit()`, returning the part of a
  command that wins conflict resolution. Bulk voxel commands now contend cell by
  cell instead of bypassing the arbiter entirely.

- [#542](https://github.com/JollyPixel/editor/pull/542) [`75a794e`](https://github.com/JollyPixel/editor/commit/75a794eb9612d34f36872e1790000ca63fc24d27) Thanks [@fraxken](https://github.com/fraxken)! - Add `TilesetAtlas`, which owns a tileset's textures; `TilesetManager` becomes a registry (`atlas()`, `has()`, `definitions()`). `TilesetLoader` becomes `loadTilesets()`.

- [#541](https://github.com/JollyPixel/editor/pull/541) [`d0b5763`](https://github.com/JollyPixel/editor/commit/d0b57630d69f2c95a39c8683020dca5bde7be3f3) Thanks [@fraxken](https://github.com/fraxken)! - `BlockDefinition` and `TileRef` are now the authoring forms, and `ResolvedBlockDefinition` and `ResolvedTileRef` what the registry stores; rename `BlockDefinitionIn` accordingly.

- [#547](https://github.com/JollyPixel/editor/pull/547) [`c96a308`](https://github.com/JollyPixel/editor/commit/c96a3085c263ca29f6028e468c6680944b6cea0b) Thanks [@fraxken](https://github.com/fraxken)! - Move layer, voxel and object edits from `VoxelEngine` to `VoxelWorld`; use `world.applyRemoteCommand()` instead of `applyCommandToWorld()`. Remote clone and merge commands now apply.

- [#623](https://github.com/JollyPixel/editor/pull/623) [`02b3b44`](https://github.com/JollyPixel/editor/commit/02b3b44814abf14c24bfea237afababa6ff8b09c) Thanks [@fraxken](https://github.com/fraxken)! - Messages are parsed with JSON Schema: extensions declare `protocols` instead of `events` and `getEventName`. Fixes rights filtering on broadcasts.

- [#566](https://github.com/JollyPixel/editor/pull/566) [`07b6dee`](https://github.com/JollyPixel/editor/commit/07b6dee9aecb69bced511459adc8237523da142e) Thanks [@fraxken](https://github.com/fraxken)! - `defineFace()` replaces `projectedFace()`, and shapes derive their occlusion from their own geometry; `shapeFaceRange()` is removed.

- [#578](https://github.com/JollyPixel/editor/pull/578) [`7ed65f3`](https://github.com/JollyPixel/editor/commit/7ed65f3b58bf7127b65965a1b3b88c8adada0c3c) Thanks [@fraxken](https://github.com/fraxken)! - Blocks are textured per shape slot instead of per face, so stairs expose every quad they render; `faceTextures` is keyed by slot.

- [#543](https://github.com/JollyPixel/editor/pull/543) [`f001d51`](https://github.com/JollyPixel/editor/commit/f001d5188499208fd1fd688189c7a3163543819f) Thanks [@fraxken](https://github.com/fraxken)! - Use `serializeVoxelWorld()` and `deserializeVoxelWorld()` instead of `VoxelSerializer`; `VoxelMapDocument` becomes the `VoxelMapState` class.

### Minor Changes

- [#589](https://github.com/JollyPixel/editor/pull/589) [`d601a72`](https://github.com/JollyPixel/editor/commit/d601a7201d33a3f1210d7025cf4b6163b7c42d3e) Thanks [@fraxken](https://github.com/fraxken)! - Add `VoxelDebugger.chunkBounds`, outlining every registered chunk independently of `mode`.

- [#526](https://github.com/JollyPixel/editor/pull/526) [`c2319ad`](https://github.com/JollyPixel/editor/commit/c2319adfeda24c36072c54a15ad8879b77d57645) Thanks [@fraxken](https://github.com/fraxken)! - Add `decodePng` and `createPixelArtBufferFromPng`, one PNG path for Node and browsers, and `resolveTilesetDefinition`.

- [#593](https://github.com/JollyPixel/editor/pull/593) [`c641170`](https://github.com/JollyPixel/editor/commit/c641170ff382d41426cfa5252e59df44a28bef97) Thanks [@fraxken](https://github.com/fraxken)! - Fix `VoxelLayer.clone()` dropping every voxel; layer clone and merge now work as expected. Add `VoxelWorld.moveObjectToLayer()`.

- [#571](https://github.com/JollyPixel/editor/pull/571) [`c9fa209`](https://github.com/JollyPixel/editor/commit/c9fa2090fc08b3151f107290459dbd050a584186) Thanks [@fraxken](https://github.com/fraxken)! - `Mouse.hovering` tells whether the pointer is over the canvas. Peer voxel edits reach local observers.

- [#524](https://github.com/JollyPixel/editor/pull/524) [`7ec0367`](https://github.com/JollyPixel/editor/commit/7ec0367c989129c9081530a9aa69f6321be929fe) Thanks [@fraxken](https://github.com/fraxken)! - Add `padAtlasRegion` and `TilesetManager.updateSourceRegion` to repad only the tiles a dirty rectangle touches, making per-frame atlas updates affordable.

- [#540](https://github.com/JollyPixel/editor/pull/540) [`517da9b`](https://github.com/JollyPixel/editor/commit/517da9b21ad2a12f7fdf697505be55e951c8ac2b) Thanks [@fraxken](https://github.com/fraxken)! - Absorb voxel utilities the voxel-map editor was reimplementing: registry
  enumeration, object extent normalization (Tiled extents now snap), and
  world-to-voxel cell conversion. `BlockDefinitionIn` defaults its optional fields.

- [#560](https://github.com/JollyPixel/editor/pull/560) [`7c8d128`](https://github.com/JollyPixel/editor/commit/7c8d128164d8c550db7ebd19529e19ee505ee6fa) Thanks [@fraxken](https://github.com/fraxken)! - Synchronize and persist block definitions: `onBlockUpdated` hooks published by
  `VoxelSyncClient` keep Block Library edits across restarts, and
  `VoxelSyncServer` now throws on invalid commands instead of logging them.

- [#565](https://github.com/JollyPixel/editor/pull/565) [`a50002e`](https://github.com/JollyPixel/editor/commit/a50002e7ba24d1b529c21e9c966ccc86e8c9f977) Thanks [@fraxken](https://github.com/fraxken)! - UV faces follow the shape they belong to, so a pole or slab edits and renders only the part of its tile the geometry covers.

- [#565](https://github.com/JollyPixel/editor/pull/565) [`a50002e`](https://github.com/JollyPixel/editor/commit/a50002e7ba24d1b529c21e9c966ccc86e8c9f977) Thanks [@fraxken](https://github.com/fraxken)! - Add `buildShapeGeometry()`, which triangulates a `BlockShape` and reports the
  vertex range each face slot owns. UV editing in voxel-map now derives its
  topology from the shape, so every built-in and custom shape is supported.

- [#539](https://github.com/JollyPixel/editor/pull/539) [`3bde59b`](https://github.com/JollyPixel/editor/commit/3bde59b0a25d61653b3200849c64bf93c3d30c8d) Thanks [@fraxken](https://github.com/fraxken)! - Add `AreaBox.color` and per-object `color` and `locked` on voxel objects. `disposeObject3D` no longer frees resources twice.

- [#566](https://github.com/JollyPixel/editor/pull/566) [`211ff42`](https://github.com/JollyPixel/editor/commit/211ff429c636962c59802316999a1ebd8721b11b) Thanks [@fraxken](https://github.com/fraxken)! - `voxelPositionOf` now resolves the cell from a small offset against the normal
  and steps one major axis for the front side, so a slanted face such as a ramp
  slope no longer resolves to the cell below or to the ramp's own cell.

- [#591](https://github.com/JollyPixel/editor/pull/591) [`eec5e52`](https://github.com/JollyPixel/editor/commit/eec5e52f462e33212e05f474e9ed44aee5a33a82) Thanks [@fraxken](https://github.com/fraxken)! - `jolly-tree` takes an `acceptDrop` veto. Add `VoxelWorld.moveLayerTo()` to move a layer to an index.

- [#545](https://github.com/JollyPixel/editor/pull/545) [`cf785ad`](https://github.com/JollyPixel/editor/commit/cf785ad789a8824abda7ca23db31b0082d9d8f07) Thanks [@fraxken](https://github.com/fraxken)! - Add new registerMany() API on BlockShapeRegistry

- [#547](https://github.com/JollyPixel/editor/pull/547) [`00b8340`](https://github.com/JollyPixel/editor/commit/00b8340d211bf933b53c38a8ad28298dfbe86004) Thanks [@fraxken](https://github.com/fraxken)! - Chunks nearest the camera build first (`rebuildFocus` is renamed `focus`), and an opt-in `viewDistance` stops meshing distant chunks.

### Patch Changes

- [#548](https://github.com/JollyPixel/editor/pull/548) [`abdd66e`](https://github.com/JollyPixel/editor/commit/abdd66ee70b63b22acabef3ab58e4a7231057627) Thanks [@fraxken](https://github.com/fraxken)! - A translucent layer is now hidden only by its own voxels, and no longer hides voxels of other layers.

- [#612](https://github.com/JollyPixel/editor/pull/612) [`6b09dd6`](https://github.com/JollyPixel/editor/commit/6b09dd6faa48f8d8600cf4a8e8a3b9126b24afb9) Thanks [@fraxken](https://github.com/fraxken)! - `isAssetEvent` becomes `parseAssetEvent`, which returns a `Result` telling a foreign event from a malformed one.

- [#628](https://github.com/JollyPixel/editor/pull/628) [`423db10`](https://github.com/JollyPixel/editor/commit/423db105df46e6ec7bb692beec0a37b1f9332fad) Thanks [@fraxken](https://github.com/fraxken)! - The extension hooks `onClientConnect`, `onClientDisconnect` and `onMessage` are optional; implementations need the `override` modifier.

- [#548](https://github.com/JollyPixel/editor/pull/548) [`2d7654d`](https://github.com/JollyPixel/editor/commit/2d7654dca12f7790da7719b84fd635fe80bb27d7) Thanks [@fraxken](https://github.com/fraxken)! - Fix z-fighting between two neighbouring voxels of the same transparent block, visible as crackling across dense foliage.

- [#544](https://github.com/JollyPixel/editor/pull/544) [`e2aae06`](https://github.com/JollyPixel/editor/commit/e2aae062e7bd773bf5f756da9aba25388ec3e305) Thanks [@fraxken](https://github.com/fraxken)! - Rework API documentation and README.md
- Updated dependencies [[`d6b2a37`](https://github.com/JollyPixel/editor/commit/d6b2a37da51adcbfc84267c5276958299f58eb7b), [`ac9bcf8`](https://github.com/JollyPixel/editor/commit/ac9bcf8696b154763828b36d09511c046cd4f036), [`66ee3e0`](https://github.com/JollyPixel/editor/commit/66ee3e0740bcf6ec96a507ad47c9d565a9750a48), [`18842ab`](https://github.com/JollyPixel/editor/commit/18842abe5ad347f63eacf8254d0685cba235adee), [`d6f6a22`](https://github.com/JollyPixel/editor/commit/d6f6a22e8d9a5644b1e27622aa00d5e1af594702), [`c9fa209`](https://github.com/JollyPixel/editor/commit/c9fa2090fc08b3151f107290459dbd050a584186), [`402c2d9`](https://github.com/JollyPixel/editor/commit/402c2d952e774d2c96ead24b7c8d11ef568128a9), [`6b09dd6`](https://github.com/JollyPixel/editor/commit/6b09dd6faa48f8d8600cf4a8e8a3b9126b24afb9), [`e83c39b`](https://github.com/JollyPixel/editor/commit/e83c39bdc271493400eecce3acd9b6568262f845), [`981f340`](https://github.com/JollyPixel/editor/commit/981f340f5933b21508a8b5acca991c8e44b451d0), [`423db10`](https://github.com/JollyPixel/editor/commit/423db105df46e6ec7bb692beec0a37b1f9332fad), [`c5e4f38`](https://github.com/JollyPixel/editor/commit/c5e4f38bafbc56cfba7a5de5d5f66e3ed1cf6f65), [`02b3b44`](https://github.com/JollyPixel/editor/commit/02b3b44814abf14c24bfea237afababa6ff8b09c), [`a9a6ca8`](https://github.com/JollyPixel/editor/commit/a9a6ca8279097ff6e64a800f797a96ab21597e1b), [`402c2d9`](https://github.com/JollyPixel/editor/commit/402c2d952e774d2c96ead24b7c8d11ef568128a9), [`82ce3e8`](https://github.com/JollyPixel/editor/commit/82ce3e8139f436f25676c1b7bcd8447e1b4db416), [`3bde59b`](https://github.com/JollyPixel/editor/commit/3bde59b0a25d61653b3200849c64bf93c3d30c8d), [`e55decb`](https://github.com/JollyPixel/editor/commit/e55decba8f0dbc35f1351ea3218360de0b5dbfc1), [`cd200eb`](https://github.com/JollyPixel/editor/commit/cd200ebf5440b27cecc74221104deae7e7bf9be6), [`4ad1299`](https://github.com/JollyPixel/editor/commit/4ad12991dc15ff5bb2ac158f9d6d6b0ce6023fd4)]:
  - @jolly-pixel/asset-server@2.0.0
  - @jolly-pixel/engine@5.0.0
  - @jolly-pixel/asset@1.1.0
  - @jolly-pixel/event-store@3.0.0
  - @jolly-pixel/network@2.0.0

## 3.0.0

### Major Changes

- [#373](https://github.com/JollyPixel/editor/pull/373) [`1e6ff52`](https://github.com/JollyPixel/editor/commit/1e6ff52068f9d82eb235ddb7f8194ba27b465d3d) Thanks [@fraxken](https://github.com/fraxken)! - Decouple `VoxelEngine` from Rapier3D behind a `VoxelCollider` interface.

- [#348](https://github.com/JollyPixel/editor/pull/348) [`32edc9a`](https://github.com/JollyPixel/editor/commit/32edc9a425ae53881aa044f6104911f4ae70d526) Thanks [@fraxken](https://github.com/fraxken)! - Voxel sync builds on `@jolly-pixel/network`'s `NetworkPlugin` and `NetworkChannel`. Rename `VoxelSyncClient` to `VoxelSyncSession` (`attach(engine)`/`detach()`) and the conflict types to `VoxelConflictResolver`/`VoxelConflictContext`.

### Minor Changes

- [#381](https://github.com/JollyPixel/editor/pull/381) [`cc387f1`](https://github.com/JollyPixel/editor/commit/cc387f12b308fffe6af62ae2b1b05084af7502c0) Thanks [@fraxken](https://github.com/fraxken)! - Faster voxel generation and meshing with lower memory use, and identical geometry.

- [#369](https://github.com/JollyPixel/editor/pull/369) [`6f6594d`](https://github.com/JollyPixel/editor/commit/6f6594d9bea483ce53f61f3c92112c727d12bb7f) Thanks [@fraxken](https://github.com/fraxken)! - Implement minimal RBAC

- [#380](https://github.com/JollyPixel/editor/pull/380) [`7d0f58b`](https://github.com/JollyPixel/editor/commit/7d0f58b9f9b3915732f8e13b5392b04d0fee0ff7) Thanks [@fraxken](https://github.com/fraxken)! - Add optional greedy meshing to `VoxelEngine`, which merges identical faces into larger quads (about 3x fewer triangles).

- [#370](https://github.com/JollyPixel/editor/pull/370) [`36c570c`](https://github.com/JollyPixel/editor/commit/36c570cf5bef538b7c59bb64b987b86f07cc91b9) Thanks [@fraxken](https://github.com/fraxken)! - Implement a minimalist Event Store workspace

- [#364](https://github.com/JollyPixel/editor/pull/364) [`cd003c3`](https://github.com/JollyPixel/editor/commit/cd003c39463f09a0735d9a58a9ac7eea0217399d) Thanks [@fraxken](https://github.com/fraxken)! - Make the network implementation easier for workspaces

- [#376](https://github.com/JollyPixel/editor/pull/376) [`a920533`](https://github.com/JollyPixel/editor/commit/a9205336bbcfd2e2684e13afa450136e9a07e579) Thanks [@fraxken](https://github.com/fraxken)! - Fix atlas bleeding that made distant voxels show white speckles and dark moiré bands.

- [#374](https://github.com/JollyPixel/editor/pull/374) [`d7a9ee4`](https://github.com/JollyPixel/editor/commit/d7a9ee4efd8a4639589dcbc78bd9e8b8d035be84) Thanks [@fraxken](https://github.com/fraxken)! - Speed up chunk meshing by roughly 5× on large worlds (a 1024×1024 noise world with 3M voxels drops from ~19s to ~3.5s at `chunkSize: 256`, and from ~28s to ~2.5s at the default `chunkSize: 16`).

- [#361](https://github.com/JollyPixel/editor/pull/361) [`34c1d7b`](https://github.com/JollyPixel/editor/commit/34c1d7b85bdf25f89988160cfdee1edeb4f7cf2f) Thanks [@fraxken](https://github.com/fraxken)! - Re-implement the network stack

- [#375](https://github.com/JollyPixel/editor/pull/375) [`6bfb934`](https://github.com/JollyPixel/editor/commit/6bfb934ada24bacbb099fdc25fa0ce5f02e29099) Thanks [@fraxken](https://github.com/fraxken)! - Add `engine.debug`, with live mesh statistics and a wireframe view toggled through `debug.mode`.

### Patch Changes

- [#413](https://github.com/JollyPixel/editor/pull/413) [`f205674`](https://github.com/JollyPixel/editor/commit/f2056748fad22b8af0c1318d108af66cc9ed6bd2) Thanks [@fraxken](https://github.com/fraxken)! - Fix WebGPU renderer issue with greedy meshing & examples

- [#389](https://github.com/JollyPixel/editor/pull/389) [`8651b1b`](https://github.com/JollyPixel/editor/commit/8651b1b7e9f15d6c410156c1294a38e16cf00d00) Thanks [@fraxken](https://github.com/fraxken)! - Add `BlockDefinition.transparent`, so blocks with alpha holes (leaves, grates, windows) stop hiding what is behind them.

- Updated dependencies [[`2788a7e`](https://github.com/JollyPixel/editor/commit/2788a7e3c0d4f04ff22df415c4bd5270c3a1208a), [`7f4df3f`](https://github.com/JollyPixel/editor/commit/7f4df3f69d15899a991e874e3c85ec1c8a70d29d), [`6f6594d`](https://github.com/JollyPixel/editor/commit/6f6594d9bea483ce53f61f3c92112c727d12bb7f), [`1ead090`](https://github.com/JollyPixel/editor/commit/1ead09093bf7de77b56242d86693b49cae68b1e0), [`b568905`](https://github.com/JollyPixel/editor/commit/b56890527e918a637d41a17a7b41f1077268d04d), [`4309016`](https://github.com/JollyPixel/editor/commit/4309016f04d38603c713c7a1a3f5e23e6e945076), [`36c570c`](https://github.com/JollyPixel/editor/commit/36c570cf5bef538b7c59bb64b987b86f07cc91b9), [`cf91f93`](https://github.com/JollyPixel/editor/commit/cf91f9336c32d8cc709a7915d2aa2fad264403c3), [`cd003c3`](https://github.com/JollyPixel/editor/commit/cd003c39463f09a0735d9a58a9ac7eea0217399d), [`6dd2fc7`](https://github.com/JollyPixel/editor/commit/6dd2fc79cf5711b8b99e1fc85e0e8471ed8b7f31), [`feaf15c`](https://github.com/JollyPixel/editor/commit/feaf15c26a42e6099994de0fee452f0350dececf), [`cd003c3`](https://github.com/JollyPixel/editor/commit/cd003c39463f09a0735d9a58a9ac7eea0217399d), [`53f66fa`](https://github.com/JollyPixel/editor/commit/53f66faee0df0be9c7500648c24e1f30918a8e32), [`34c1d7b`](https://github.com/JollyPixel/editor/commit/34c1d7b85bdf25f89988160cfdee1edeb4f7cf2f), [`10fef00`](https://github.com/JollyPixel/editor/commit/10fef008eae61e8b8cb163a80c66c82ae68ab98e)]:
  - @jolly-pixel/network@1.1.0
  - @jolly-pixel/engine@4.0.0

## 2.0.0

### Major Changes

- [#310](https://github.com/JollyPixel/editor/pull/310) [`6447779`](https://github.com/JollyPixel/editor/commit/64477791f5dae06af2f420d61d872c3c2d97103e) Thanks [@fraxken](https://github.com/fraxken)! - Expose TMJ loading as a plugins in voxel.renderer and fix the TMJ example by preloading scene assets in engine and runtime

- [#268](https://github.com/JollyPixel/editor/pull/268) [`83b0dc4`](https://github.com/JollyPixel/editor/commit/83b0dc4b11cca367714ea9c90d43fb6830759d11) Thanks [@fraxken](https://github.com/fraxken)! - Implement new Network API to synchronize world between multiple clients

- [#294](https://github.com/JollyPixel/editor/pull/294) [`7b4d75c`](https://github.com/JollyPixel/editor/commit/7b4d75c8923b2d57608d0d9959e50b27fd9f5d87) Thanks [@fraxken](https://github.com/fraxken)! - Extract `VoxelEngine` from `VoxelRenderer` so voxel worlds work without `@jolly-pixel/engine`, for example on a server. `VoxelSyncClientOptions.renderer` is renamed `engine`.

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
