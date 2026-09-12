# @jolly-pixel/voxel.renderer

## 5.0.0

### Major Changes

- [#639](https://github.com/JollyPixel/editor/pull/639) [`55a1230`](https://github.com/JollyPixel/editor/commit/55a12309b7e3d4a3c7ba7efc47766655abaf10f9) Thanks [@fraxken](https://github.com/fraxken)! - Authenticate connections at the WebSocket handshake through a server-configured
  `AuthenticationProvider`, and split the trusted `PeerIdentity` from the client's
  untrusted `profile` (renamed from `identity`).
  Rooms now report a joining client's resolved rights, and a role absent from a
  configured rights table is denied instead of granted.

### Minor Changes

- [#643](https://github.com/JollyPixel/editor/pull/643) [`c22f8a9`](https://github.com/JollyPixel/editor/commit/c22f8a9407ac534117ce8f74e61d454d721c0044) Thanks [@fraxken](https://github.com/fraxken)! - Make the block table's order editable and durable. `BlockRegistry.moveTo()`
  relocates a definition, `VoxelEngine.moveBlock()` emits it as a new
  `block-moved` hook and network command, and the document's `blocks` array
  round trips that order.

- [#641](https://github.com/JollyPixel/editor/pull/641) [`4029a4d`](https://github.com/JollyPixel/editor/commit/4029a4d9da915a4b191a00cad2a92e0d2fe8f544) Thanks [@fraxken](https://github.com/fraxken)! - Blend the cutout draw group of `transparent` blocks instead of only alpha-testing
  it, so a texel of partial alpha fades rather than coming out solid; the group
  still writes depth. Add `BlockDefinition.cullSelfFaces`, which keeps the boundary
  two voxels of the same transparent block share, emitted once from its positive
  side so the coplanar pair no longer z-fights.

- [#638](https://github.com/JollyPixel/editor/pull/638) [`5596bfb`](https://github.com/JollyPixel/editor/commit/5596bfb3d6151ff7b320f2bde32befc2f497d857) Thanks [@fraxken](https://github.com/fraxken)! - Add `properties` to `BlockDefinition`, a scalar map carried for game code and
  scrubbed of non-scalar values when resolved. Read a copy with
  `BlockRegistry.propertiesOf()` or, by world position, with the new
  `VoxelEngine.blockAt()` and `VoxelEngine.blockPropertiesAt()`.

### Patch Changes

- Updated dependencies [[`f0363be`](https://github.com/JollyPixel/editor/commit/f0363bea0dafae6f2e899b491c6f4c6d4f777acb), [`55a1230`](https://github.com/JollyPixel/editor/commit/55a12309b7e3d4a3c7ba7efc47766655abaf10f9)]:
  - @jolly-pixel/asset-server@3.0.0
  - @jolly-pixel/network@3.0.0

## 4.0.0

### Major Changes

- [#618](https://github.com/JollyPixel/editor/pull/618) [`d6b2a37`](https://github.com/JollyPixel/editor/commit/d6b2a37da51adcbfc84267c5276958299f58eb7b) Thanks [@fraxken](https://github.com/fraxken)! - Replace the per-kind room extension with a declarative `live()` protocol hosted
  by asset-server's new `AssetRoomExtension`. `PixelArtAssetExtension` and
  `VoxelMapAssetExtension` are removed; `PixelCommandArbiter.admit()` now defers
  recording to the returned arbitration, so a refused append no longer poisons
  the conflict trackers.

- [#546](https://github.com/JollyPixel/editor/pull/546) [`a865770`](https://github.com/JollyPixel/editor/commit/a865770108f0a79438a3b48f4f42267a637525f5) Thanks [@fraxken](https://github.com/fraxken)! - Model four packed or normalized concepts as value objects: `VoxelTransform` for
  rotation and flip bits, `AtlasLayout` for the atlas tile grid, `VoxelFootprint`
  for an object's whole-cell area, and `ChunkGeometryKey` for a draw group. Each
  owns its invariant in one place, so `ChunkGeometryKey` now rejects a tileset id
  ending in `:cutout` rather than silently aliasing two draw groups, and a
  rotation outside `0..3` wraps instead of spilling into the flip bits.
  
  BREAKING: `normalizeVoxelExtent()`, `voxelObjectFootprint()` and
  `VoxelObjectFootprint` are replaced by `VoxelFootprint`, `packTransform()` and
  `unpackTransform()` by `VoxelTransform`, and `AtlasLayout` is a class rather
  than a plain interface.

- [#541](https://github.com/JollyPixel/editor/pull/541) [`3a0c3e5`](https://github.com/JollyPixel/editor/commit/3a0c3e55d59e2252a8112c8df76072ad95b88ae5) Thanks [@fraxken](https://github.com/fraxken)! - Enforce the reserved air id at the write path. `packVoxel()` now throws on block
  id 0 instead of storing a phantom voxel, and `BlockRegistry`'s constructor
  rejects an air definition like `register()` already did rather than skipping it.
  `AIR_BLOCK_ID` and `isAir()` are exported.

- [#580](https://github.com/JollyPixel/editor/pull/580) [`8840d6e`](https://github.com/JollyPixel/editor/commit/8840d6ea92beb5ce75fe620422590d74ebc4f40c) Thanks [@fraxken](https://github.com/fraxken)! - Flip the meaning of `VoxelWorld.moveLayer()` directions: `"up"` now raises a
  layer's compositing priority and `"down"` lowers it. The voxel-map layer tree
  lists layers highest priority first, so the layer on top renders on top.

- [#581](https://github.com/JollyPixel/editor/pull/581) [`3606760`](https://github.com/JollyPixel/editor/commit/360676096137146945381e2a0ace6597bad45ecd) Thanks [@fraxken](https://github.com/fraxken)! - `VoxelCommandArbiter.resolve()` is replaced by `admit()`, returning the part of a
  command that wins conflict resolution. Bulk voxel commands now contend cell by
  cell instead of bypassing the arbiter entirely.

- [#542](https://github.com/JollyPixel/editor/pull/542) [`75a794e`](https://github.com/JollyPixel/editor/commit/75a794eb9612d34f36872e1790000ca63fc24d27) Thanks [@fraxken](https://github.com/fraxken)! - Extract `TilesetAtlas` so a registered atlas owns its grid, textures and padding,
  leaving `TilesetManager` a registry: `atlas()`/`has()`/`definitions()` replace the
  `get*` accessors, and `updateSourceImage`/`updateSourceRegion` collapse into
  `TilesetAtlas.updateSource(image, bounds?)`.
  
  `TilesetLoader` becomes `loadTilesets()`, which fetches in parallel and feeds
  `VoxelEngineOptions.tilesets`; `getDefaultBlocks` moves to `blocksFromTileset` in
  `blocks/`, and `enableTileWrapping` moves to `mesh/`.

- [#541](https://github.com/JollyPixel/editor/pull/541) [`d0b5763`](https://github.com/JollyPixel/editor/commit/d0b57630d69f2c95a39c8683020dca5bde7be3f3) Thanks [@fraxken](https://github.com/fraxken)! - Rename the block and tile types after their intent: `BlockDefinition` is now the
  authoring form (formerly `BlockDefinitionIn`) and `ResolvedBlockDefinition` what
  `BlockRegistry` stores; likewise `TileRef` is the authoring union and
  `ResolvedTileRef` the object form. `BlockRegistry.register()` no longer mutates
  the definition it is given.

- [#547](https://github.com/JollyPixel/editor/pull/547) [`c96a308`](https://github.com/JollyPixel/editor/commit/c96a3085c263ca29f6028e468c6680944b6cea0b) Thanks [@fraxken](https://github.com/fraxken)! - Move layer, voxel and object mutations from `VoxelEngine` to `VoxelWorld`, which
  now emits the hook events and applies remote commands itself. `VoxelEngine` keeps
  rendering, tilesets and persistence, and delegates its chunk meshes, materials,
  rebuild queue and view-distance culling to collaborators under `src/render`.
  Remote `cloned` and `merged` commands were silently dropped and now apply;
  `applyCommandToWorld()` is replaced by `world.applyRemoteCommand()`.

- [#623](https://github.com/JollyPixel/editor/pull/623) [`02b3b44`](https://github.com/JollyPixel/editor/commit/02b3b44814abf14c24bfea237afababa6ff8b09c) Thanks [@fraxken](https://github.com/fraxken)! - Parse the wire with JSON Schema instead of hand-rolled guards. Envelopes split
  by direction (`Envelope.parseClient` / `parseServer`), and an extension now
  declares `protocols` in place of `events` and `getEventName`, so the room parses
  payloads and derives rights keys from the schema variant that matched.
  
  This fixes broadcast filtering: outbound payloads were gated on an event name
  they never carried, so with a rights table configured a `voxel.renderer.*` rule
  filtered the wrong key on every fan-out.

- [#566](https://github.com/JollyPixel/editor/pull/566) [`07b6dee`](https://github.com/JollyPixel/editor/commit/07b6dee9aecb69bced511459adc8237523da142e) Thanks [@fraxken](https://github.com/fraxken)! - `defineFace()` replaces `projectedFace()` and resolves both `uvs` and `cull`,
  so `FaceDefinition` has no optional member left, and `BlockShapeBase` derives
  `occludes()` from the shape's own geometry. `shapeFaceRange()` is gone; each
  range now carries the `definitions` it was built from.

- [#578](https://github.com/JollyPixel/editor/pull/578) [`7ed65f3`](https://github.com/JollyPixel/editor/commit/7ed65f3b58bf7127b65965a1b3b88c8adada0c3c) Thanks [@fraxken](https://github.com/fraxken)! - Texture a block per shape slot instead of per face, so stairs expose every quad
  they render: `faceTextures` is keyed by slot, `UVFace` is an open string, and a
  slot holding several polygons draws as a compound outlined along the union of
  its parts, so a stair side reads as one L rather than two stacked rectangles.
  Collapsing a region stacks every slot on the shared rectangle and always takes
  the largest face. The `PosX`, `NegX`, `PosY` and `NegY` projectors no longer
  mirror their tile, with the horizontal faces keyed to the back of the block.

- [#543](https://github.com/JollyPixel/editor/pull/543) [`f001d51`](https://github.com/JollyPixel/editor/commit/f001d5188499208fd1fd688189c7a3163543819f) Thanks [@fraxken](https://github.com/fraxken)! - `serialization/` now owns the document format end to end: `VoxelSerializer` is
  replaced by `serializeVoxelWorld()` / `deserializeVoxelWorld()` (and
  `VoxelEngine.serializer` is gone), while `asset/VoxelMapDocument.ts` folds into
  a `VoxelMapState` class with `toJSON()` / `load()` / `clear()`.

### Minor Changes

- [#589](https://github.com/JollyPixel/editor/pull/589) [`d601a72`](https://github.com/JollyPixel/editor/commit/d601a7201d33a3f1210d7025cf4b6163b7c42d3e) Thanks [@fraxken](https://github.com/fraxken)! - Add `VoxelDebugger.chunkBounds`, outlining every registered chunk independently of `mode`.

- [#526](https://github.com/JollyPixel/editor/pull/526) [`c2319ad`](https://github.com/JollyPixel/editor/commit/c2319adfeda24c36072c54a15ad8879b77d57645) Thanks [@fraxken](https://github.com/fraxken)! - Add `decodePng` and `createPixelArtBufferFromPng`, a single environment-agnostic
  PNG path shared by the Node seed pipeline and by browsers without `ImageDecoder`,
  where texture imports previously went through a premultiplying canvas.
  Also add `resolveTilesetDefinition`, so a seeded document and a loaded texture
  derive the same tile grid.

- [#593](https://github.com/JollyPixel/editor/pull/593) [`c641170`](https://github.com/JollyPixel/editor/commit/c641170ff382d41426cfa5252e59df44a28bef97) Thanks [@fraxken](https://github.com/fraxken)! - Fix `VoxelLayer.clone()` dropping every voxel, and make layer clone and merge
  usable: a clone lands above its source under a derived unique name, and a merge
  consumes the source, keeping the higher layer's voxels. Adds
  `VoxelWorld.moveObjectToLayer()` so reparenting an object is one conflict-keyed
  command instead of a remove/add pair that could duplicate it.

- [#571](https://github.com/JollyPixel/editor/pull/571) [`c9fa209`](https://github.com/JollyPixel/editor/commit/c9fa2090fc08b3151f107290459dbd050a584186) Thanks [@fraxken](https://github.com/fraxken)! - `Mouse` tracks whether the pointer sits over the canvas as `hovering`, with
  `enter` and `leave` events, so a consumer can tell a live `position` from the
  stale one left behind when the pointer moves onto surrounding UI.
  `SyncAdapter.notifyLocal()` replays an event to the handler captured at
  `attach()`, which `VoxelSyncClient` now uses so a peer's edit reaches local
  observers, and hiding, showing or removing a layer marks every layer's chunks
  dirty for cross-layer face culling.

- [#524](https://github.com/JollyPixel/editor/pull/524) [`7ec0367`](https://github.com/JollyPixel/editor/commit/7ec0367c989129c9081530a9aa69f6321be929fe) Thanks [@fraxken](https://github.com/fraxken)! - Add `padAtlasRegion` and `TilesetManager.updateSourceRegion` to repad only the tiles a dirty rectangle touches, making per-frame atlas updates affordable.

- [#540](https://github.com/JollyPixel/editor/pull/540) [`517da9b`](https://github.com/JollyPixel/editor/commit/517da9b21ad2a12f7fdf697505be55e951c8ac2b) Thanks [@fraxken](https://github.com/fraxken)! - Absorb voxel utilities the voxel-map editor was reimplementing: registry
  enumeration, object extent normalization (Tiled extents now snap), and
  world-to-voxel cell conversion. `BlockDefinitionIn` defaults its optional fields.

- [#560](https://github.com/JollyPixel/editor/pull/560) [`7c8d128`](https://github.com/JollyPixel/editor/commit/7c8d128164d8c550db7ebd19529e19ee505ee6fa) Thanks [@fraxken](https://github.com/fraxken)! - Synchronize and persist block definitions: `onBlockUpdated` hooks published by
  `VoxelSyncClient` keep Block Library edits across restarts, and
  `VoxelSyncServer` now throws on invalid commands instead of logging them.

- [#565](https://github.com/JollyPixel/editor/pull/565) [`a50002e`](https://github.com/JollyPixel/editor/commit/a50002e7ba24d1b529c21e9c966ccc86e8c9f977) Thanks [@fraxken](https://github.com/fraxken)! - Map every UV face to the shape it belongs to, so a pole or slab edits and
  renders over the part of its tile the geometry actually covers.
  
  - Built-in shapes state each face's UVs as its own footprint, exposed through
    `projectFaceUv()`, `faceUvs()` and `projectedFace()`.
  - The voxel-map UV editor derives per-face regions from the block's shape and
    leaves only a plain cube collapsible.
  - A collapse round-trip keeps each face's own size, and collapses onto the
    largest active face rather than the smallest.
  - Chunk materials clamp each face to its atlas rect, so atlases ship unpadded
    and a UV rect at a fractional offset stops sampling the tile gutter.

- [#565](https://github.com/JollyPixel/editor/pull/565) [`a50002e`](https://github.com/JollyPixel/editor/commit/a50002e7ba24d1b529c21e9c966ccc86e8c9f977) Thanks [@fraxken](https://github.com/fraxken)! - Add `buildShapeGeometry()`, which triangulates a `BlockShape` and reports the
  vertex range each face slot owns. UV editing in voxel-map now derives its
  topology from the shape, so every built-in and custom shape is supported.

- [#539](https://github.com/JollyPixel/editor/pull/539) [`3bde59b`](https://github.com/JollyPixel/editor/commit/3bde59b0a25d61653b3200849c64bf93c3d30c8d) Thanks [@fraxken](https://github.com/fraxken)! - Rebuild the layers tab around one tree holding objects as rows, with a single
  add dialog, per-object color and lock, and editable properties. Adds
  `AreaBox.color`, `VoxelObjectJSON.color`/`locked`, and stops `disposeObject3D`
  freeing the resources a self-disposing node already released.

- [#566](https://github.com/JollyPixel/editor/pull/566) [`211ff42`](https://github.com/JollyPixel/editor/commit/211ff429c636962c59802316999a1ebd8721b11b) Thanks [@fraxken](https://github.com/fraxken)! - `voxelPositionOf` now resolves the cell from a small offset against the normal
  and steps one major axis for the front side, so a slanted face such as a ramp
  slope no longer resolves to the cell below or to the ramp's own cell.

- [#591](https://github.com/JollyPixel/editor/pull/591) [`eec5e52`](https://github.com/JollyPixel/editor/commit/eec5e52f462e33212e05f474e9ed44aee5a33a82) Thanks [@fraxken](https://github.com/fraxken)! - `jolly-tree` takes an `acceptDrop` domain veto, consulted while dragging and on
  commit. `VoxelWorld.moveLayerTo()` moves a layer to an absolute index and emits
  a `layer-moved` command. The voxel-map layer tree is reordered by drag instead
  of the arrow buttons, which are gone.

- [#545](https://github.com/JollyPixel/editor/pull/545) [`cf785ad`](https://github.com/JollyPixel/editor/commit/cf785ad789a8824abda7ca23db31b0082d9d8f07) Thanks [@fraxken](https://github.com/fraxken)! - Add new registerMany() API on BlockShapeRegistry

- [#547](https://github.com/JollyPixel/editor/pull/547) [`00b8340`](https://github.com/JollyPixel/editor/commit/00b8340d211bf933b53c38a8ad28298dfbe86004) Thanks [@fraxken](https://github.com/fraxken)! - Build chunks nearest the camera first: `rebuildFocus` is renamed `focus`, is
  resampled as the focus moves, and `VoxelRenderer` can track an `Object3D`.
  Adds an opt-in `viewDistance` that stops meshing chunks beyond a chunk radius
  and either hides or unloads the ones that leave it.

### Patch Changes

- [#548](https://github.com/JollyPixel/editor/pull/548) [`abdd66e`](https://github.com/JollyPixel/editor/commit/abdd66ee70b63b22acabef3ab58e4a7231057627) Thanks [@fraxken](https://github.com/fraxken)! - Scope mesh occlusion to the layer it belongs to. A translucent layer
  (`0 < opacity < 1`) is now occluded only by its own voxels: its faces survive
  against opaque neighbours in other layers, and it no longer occludes them or
  wins compositing over the voxels it covers.

- [#612](https://github.com/JollyPixel/editor/pull/612) [`6b09dd6`](https://github.com/JollyPixel/editor/commit/6b09dd6faa48f8d8600cf4a8e8a3b9126b24afb9) Thanks [@fraxken](https://github.com/fraxken)! - Parse asset event payloads instead of validating them. `isAssetEvent` becomes
  `parseAssetEvent`, returning `Result<AssetEvent, AssetEventRejection>` that
  separates a foreign event from a malformed one; payload types now derive from
  the JSON Schemas that check them, and `decodeContent` takes `AssetInlineContent`
  so it can no longer throw.

- [#628](https://github.com/JollyPixel/editor/pull/628) [`423db10`](https://github.com/JollyPixel/editor/commit/423db105df46e6ec7bb692beec0a37b1f9332fad) Thanks [@fraxken](https://github.com/fraxken)! - `Extension.onClientConnect`, `onClientDisconnect` and `onMessage` are now
  optional; the room skips a hook it does not find and drops such a message with a
  `debug` log. Implementations need the `override` modifier, as `dispose` already
  did, and a worker extension reports its hooks at ready time so an omitted one
  costs no RPC round-trip.

- [#548](https://github.com/JollyPixel/editor/pull/548) [`2d7654d`](https://github.com/JollyPixel/editor/commit/2d7654dca12f7790da7719b84fd635fe80bb27d7) Thanks [@fraxken](https://github.com/fraxken)! - Cull the face two neighbours of the same transparent block share. Emitting both
  put two coplanar quads on one plane, which z-fought into visible crackling
  across dense foliage. A transparent block still hides nothing of a different
  block, so its alpha holes keep revealing what is behind them.

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
