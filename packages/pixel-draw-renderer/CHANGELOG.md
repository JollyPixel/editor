# @jolly-pixel/pixel-draw.renderer

## 4.0.0

### Major Changes

- [#618](https://github.com/JollyPixel/editor/pull/618) [`d6b2a37`](https://github.com/JollyPixel/editor/commit/d6b2a37da51adcbfc84267c5276958299f58eb7b) Thanks [@fraxken](https://github.com/fraxken)! - Replace the per-kind room extension with a declarative `live()` protocol hosted
  by asset-server's new `AssetRoomExtension`. `PixelArtAssetExtension` and
  `VoxelMapAssetExtension` are removed; `PixelCommandArbiter.admit()` now defers
  recording to the returned arbitration, so a refused append no longer poisons
  the conflict trackers.

- [#608](https://github.com/JollyPixel/editor/pull/608) [`ad9861d`](https://github.com/JollyPixel/editor/commit/ad9861dedfc2839f1dba4d6ae496f40737682fc7) Thanks [@fraxken](https://github.com/fraxken)! - Replace face-named UV runtime APIs with `DEFAULT_UV_SLOTS`, `slots`, `slotsOf()`, `selectedSlot`, and slot-named create options.
  Consolidate UV storage, geometry, overlay projection, drag cleanup, target keys, and validation while retaining the existing serialized region fields.

- [#550](https://github.com/JollyPixel/editor/pull/550) [`e282c08`](https://github.com/JollyPixel/editor/commit/e282c08f6857bc99dc33f343a831395d0e8716fd) Thanks [@fraxken](https://github.com/fraxken)! - Rename `PixelCursorSyncOptions.getLabel` to `label` and add a `color` callback,
  so a host can key peer cursor colors on a stable identity field instead of the
  per-connection `clientId`.

- [#618](https://github.com/JollyPixel/editor/pull/618) [`8c634f1`](https://github.com/JollyPixel/editor/commit/8c634f1add3ec76e3a63d62bf6ae5bbd97e91a63) Thanks [@fraxken](https://github.com/fraxken)! - Split `src/asset` into `src/serialization` (document format, codec, buffer
  mapping) and `src/asset` (asset-server handler, extension, `PixelArtState`).
  The codec now ships from the package root, so reading a `.pixelart` document
  no longer pulls `@jolly-pixel/asset-server` into the graph.

- [#564](https://github.com/JollyPixel/editor/pull/564) [`1541725`](https://github.com/JollyPixel/editor/commit/1541725c977cc4b74cf05045c2674585150a1383) Thanks [@fraxken](https://github.com/fraxken)! - Remove `decodePng`, `InvalidPngError`, `DecodedPng` and `decodeRasterCanvas`
  from the public API; they now live in `@jolly-pixel/image`. `decodeRasterBlob`
  keeps its name and shape, and `encodeSelectionPng` output is now byte-exact
  rather than round-tripped through a premultiplying canvas.

- [#623](https://github.com/JollyPixel/editor/pull/623) [`02b3b44`](https://github.com/JollyPixel/editor/commit/02b3b44814abf14c24bfea237afababa6ff8b09c) Thanks [@fraxken](https://github.com/fraxken)! - Parse the wire with JSON Schema instead of hand-rolled guards. Envelopes split
  by direction (`Envelope.parseClient` / `parseServer`), and an extension now
  declares `protocols` in place of `events` and `getEventName`, so the room parses
  payloads and derives rights keys from the schema variant that matched.
  
  This fixes broadcast filtering: outbound payloads were gated on an event name
  they never carried, so with a rights table configured a `voxel.renderer.*` rule
  filtered the wrong key on every fan-out.

- [#519](https://github.com/JollyPixel/editor/pull/519) [`a0f07ca`](https://github.com/JollyPixel/editor/commit/a0f07ca1f5d8ba66dd4819688602b51942036c1b) Thanks [@fraxken](https://github.com/fraxken)! - Add `@jolly-pixel/color`: a dependency-free CSS color parser, converter, formatter and
  deterministic palette, replacing `colorjs.io` and the duplicated color helpers across the editors.

- [#578](https://github.com/JollyPixel/editor/pull/578) [`7ed65f3`](https://github.com/JollyPixel/editor/commit/7ed65f3b58bf7127b65965a1b3b88c8adada0c3c) Thanks [@fraxken](https://github.com/fraxken)! - Texture a block per shape slot instead of per face, so stairs expose every quad
  they render: `faceTextures` is keyed by slot, `UVFace` is an open string, and a
  slot holding several polygons draws as a compound outlined along the union of
  its parts, so a stair side reads as one L rather than two stacked rectangles.
  Collapsing a region stacks every slot on the shared rectangle and always takes
  the largest face. The `PosX`, `NegX`, `PosY` and `NegY` projectors no longer
  mirror their tile, with the horizontal faces keyed to the back of the block.

- [#601](https://github.com/JollyPixel/editor/pull/601) [`7b3c9de`](https://github.com/JollyPixel/editor/commit/7b3c9dec8aa72719a9e5f5df601cfd693fcaff26) Thanks [@fraxken](https://github.com/fraxken)! - Add an `unfolded` UV region state that packs the active faces into a net and
  drags them as one, and rename the pair around it: `collapsed` is now `stacked`
  and `uncollapsed` is now `free`. `UVMap.collapse()`/`uncollapse()` are replaced
  by `setState(id, state, face?)`, `UVRegion` gains `stack()`/`unfold()`/`free()`
  plus `bounds` and `translated()`, and `state` is required on `UVRegionData`, so
  documents written with the old names no longer load. The pixel-art toolbar
  swaps its single toggle for a state dropdown, and unfolding a voxel-map block
  claims one atlas tile per face.

### Minor Changes

- [#526](https://github.com/JollyPixel/editor/pull/526) [`c2319ad`](https://github.com/JollyPixel/editor/commit/c2319adfeda24c36072c54a15ad8879b77d57645) Thanks [@fraxken](https://github.com/fraxken)! - Add `decodePng` and `createPixelArtBufferFromPng`, a single environment-agnostic
  PNG path shared by the Node seed pipeline and by browsers without `ImageDecoder`,
  where texture imports previously went through a premultiplying canvas.
  Also add `resolveTilesetDefinition`, so a seeded document and a loaded texture
  derive the same tile grid.

- [#528](https://github.com/JollyPixel/editor/pull/528) [`d6f6a22`](https://github.com/JollyPixel/editor/commit/d6f6a22e8d9a5644b1e27622aa00d5e1af594702) Thanks [@fraxken](https://github.com/fraxken)! - Cut editor boot time by stopping the client from re-uploading its whole
  placeholder atlas on every load, resuming asset replay from the last snapshot
  checkpoint, and letting rooms resolve without blocking one another.

- [#575](https://github.com/JollyPixel/editor/pull/575) [`055990e`](https://github.com/JollyPixel/editor/commit/055990eb87908a5fc721a47b8d0b9ad456afabef) Thanks [@fraxken](https://github.com/fraxken)! - Selection overlay shows its size ("16×16") next to the outline, anchored
  below the bottom-right corner. Opt out with `select.sizeLabel: false`.
  `DefaultViewport` gains `canvasWidth` / `canvasHeight`.

- [#524](https://github.com/JollyPixel/editor/pull/524) [`7ec0367`](https://github.com/JollyPixel/editor/commit/7ec0367c989129c9081530a9aa69f6321be929fe) Thanks [@fraxken](https://github.com/fraxken)! - `CanvasBuffer` now emits `changed` with dirty bounds, plus `resized` and `replaced`. `PixelDocument` forwards them and is exposed as `PixelArtCanvas.document`, replacing `PixelDocument.onChange`/`offChange`.

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

- [#599](https://github.com/JollyPixel/editor/pull/599) [`18c4ea9`](https://github.com/JollyPixel/editor/commit/18c4ea96c24b9dc85bf33cb86250d847c56ef7c8) Thanks [@fraxken](https://github.com/fraxken)! - Add an erase mode: the brush drawing `brush.erase` (transparent by default,
  overridable with the new `brush.eraseColor` option) with the same size, line
  and mouse-button behavior as painting.

- [#482](https://github.com/JollyPixel/editor/pull/482) [`8444ce6`](https://github.com/JollyPixel/editor/commit/8444ce69ba3162983f8eac4349f536371c036029) Thanks [@fraxken](https://github.com/fraxken)! - Refactor internal APIs and Types

- [#579](https://github.com/JollyPixel/editor/pull/579) [`72fb83a`](https://github.com/JollyPixel/editor/commit/72fb83abb6ff6a568b552e4baa85d5ce1755f21c) Thanks [@fraxken](https://github.com/fraxken)! - Add `uv.deselectOnEmptyClick` to `PixelArtCanvasOptions`, controlling whether a
  UV-mode click outside every visible region clears the selection (default `true`).
  The voxel-map texture editor disables it so the block library keeps ownership of
  the UV selection, and now also wires `PixelStrokeGhostSync` and
  `SelectionGhostSync` so peers see strokes and selections before they commit.

### Patch Changes

- [#521](https://github.com/JollyPixel/editor/pull/521) [`02bc332`](https://github.com/JollyPixel/editor/commit/02bc3329e46bf536727ad696140dc7d09ccccb92) Thanks [@fraxken](https://github.com/fraxken)! - Refactor voxel-map editor to use @jolly-pixel/ui components (+ diverses bug fixes)

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

- [#608](https://github.com/JollyPixel/editor/pull/608) [`2667412`](https://github.com/JollyPixel/editor/commit/266741294201a94f3d86644de3a2922c5d4237be) Thanks [@fraxken](https://github.com/fraxken)! - A UV click now picks the face painted on top, and repeat clicks cycle only
  through the faces exactly coincident with it. A face that merely overlaps is
  below it and can no longer be selected through it.
- Updated dependencies [[`d6b2a37`](https://github.com/JollyPixel/editor/commit/d6b2a37da51adcbfc84267c5276958299f58eb7b), [`ac9bcf8`](https://github.com/JollyPixel/editor/commit/ac9bcf8696b154763828b36d09511c046cd4f036), [`d6f6a22`](https://github.com/JollyPixel/editor/commit/d6f6a22e8d9a5644b1e27622aa00d5e1af594702), [`c9fa209`](https://github.com/JollyPixel/editor/commit/c9fa2090fc08b3151f107290459dbd050a584186), [`402c2d9`](https://github.com/JollyPixel/editor/commit/402c2d952e774d2c96ead24b7c8d11ef568128a9), [`6b09dd6`](https://github.com/JollyPixel/editor/commit/6b09dd6faa48f8d8600cf4a8e8a3b9126b24afb9), [`423db10`](https://github.com/JollyPixel/editor/commit/423db105df46e6ec7bb692beec0a37b1f9332fad), [`02b3b44`](https://github.com/JollyPixel/editor/commit/02b3b44814abf14c24bfea237afababa6ff8b09c), [`1541725`](https://github.com/JollyPixel/editor/commit/1541725c977cc4b74cf05045c2674585150a1383), [`a9a6ca8`](https://github.com/JollyPixel/editor/commit/a9a6ca8279097ff6e64a800f797a96ab21597e1b), [`402c2d9`](https://github.com/JollyPixel/editor/commit/402c2d952e774d2c96ead24b7c8d11ef568128a9), [`4ad1299`](https://github.com/JollyPixel/editor/commit/4ad12991dc15ff5bb2ac158f9d6d6b0ce6023fd4)]:
  - @jolly-pixel/asset-server@2.0.0
  - @jolly-pixel/event-store@3.0.0
  - @jolly-pixel/network@2.0.0
  - @jolly-pixel/image@1.1.0

## 3.0.0

### Major Changes

- [#346](https://github.com/JollyPixel/editor/pull/346) [`2788a7e`](https://github.com/JollyPixel/editor/commit/2788a7e3c0d4f04ff22df415c4bd5270c3a1208a) Thanks [@fraxken](https://github.com/fraxken)! - Wire first implementation of @jolly-pixel/network

- [#450](https://github.com/JollyPixel/editor/pull/450) [`bfce501`](https://github.com/JollyPixel/editor/commit/bfce5015e71ed5f4fd48bfc753560f049842121b) Thanks [@fraxken](https://github.com/fraxken)! - Implement real-time ghost preview

- [#439](https://github.com/JollyPixel/editor/pull/439) [`e1ce8bb`](https://github.com/JollyPixel/editor/commit/e1ce8bb3e4257e8acce9083d047efd15861122a5) Thanks [@fraxken](https://github.com/fraxken)! - Implement support of Triangle shape and UV with custom faces

- [#421](https://github.com/JollyPixel/editor/pull/421) [`02393d9`](https://github.com/JollyPixel/editor/commit/02393d9839607858a4083d0cab90a4cbc63b3000) Thanks [@fraxken](https://github.com/fraxken)! - UV regions can now map a different rect per cube face.

- [#339](https://github.com/JollyPixel/editor/pull/339) [`5421766`](https://github.com/JollyPixel/editor/commit/5421766acf8d1c8dfa884c03f8fbda4732d4896b) Thanks [@fraxken](https://github.com/fraxken)! - Refactor APIs and reduce implementating coupling + references mixing

- [#455](https://github.com/JollyPixel/editor/pull/455) [`7e96c79`](https://github.com/JollyPixel/editor/commit/7e96c79547b4b72de45ed0dbc5d5a6d9b009e212) Thanks [@fraxken](https://github.com/fraxken)! - Replace the five peer overlay properties on `PixelArtCanvas` with the grouped `peerPresence` API. Presence rendering now uses `cursors`, `strokes`, `uv`, `selectionOutlines` and `floatingSelections`.

- [#383](https://github.com/JollyPixel/editor/pull/383) [`62873b3`](https://github.com/JollyPixel/editor/commit/62873b348974dba8df26a829aa7eea2bfcfafb1b) Thanks [@fraxken](https://github.com/fraxken)! - Migrate pixel-draw-renderer UI inside a dedicated pixel-art editor and then re-use it inside voxel-map editor.

### Minor Changes

- [#341](https://github.com/JollyPixel/editor/pull/341) [`5dfb888`](https://github.com/JollyPixel/editor/commit/5dfb888a8611e0a8a048495e220273eb9c50f24f) Thanks [@fraxken](https://github.com/fraxken)! - Remove createInputActions factory for new Architecture resistant to scale with a better mode management"

- [#442](https://github.com/JollyPixel/editor/pull/442) [`b17cff7`](https://github.com/JollyPixel/editor/commit/b17cff78bf3003bacafe79a387730670b742c145) Thanks [@fraxken](https://github.com/fraxken)! - Add optional names to UV regions and a toolbar toggle for displaying name/id labels inside visible UVs. Show All now forces labels while preserving the independent label preference.

- [#438](https://github.com/JollyPixel/editor/pull/438) [`1fd567f`](https://github.com/JollyPixel/editor/commit/1fd567fcc5477a4863d3aa9026f0b97c179e19a0) Thanks [@fraxken](https://github.com/fraxken)! - Ctrl+scroll brush resizing with immediate overlay refresh.

- [#358](https://github.com/JollyPixel/editor/pull/358) [`dbf64ee`](https://github.com/JollyPixel/editor/commit/dbf64eee82e367ddf67bc9f01186df5ab2cb4f43) Thanks [@fraxken](https://github.com/fraxken)! - Add multiplayer cursor tracking. `PixelArtCanvas` can now report your cursor with `onCursorMove` and show other players with `peerCursors`. `PixelCursorSession` sends and receives cursor updates over any compatible `NetworkChannel`, including one already used by `PixelSyncSession`. Peer colors and `UVMap` region colors now use the same `ColorPalette`.

- [#457](https://github.com/JollyPixel/editor/pull/457) [`250ea2b`](https://github.com/JollyPixel/editor/commit/250ea2b7742457ac280872ed9538a78a747a3d96) Thanks [@fraxken](https://github.com/fraxken)! - Enhance performance on buffer hot path

- [#369](https://github.com/JollyPixel/editor/pull/369) [`6f6594d`](https://github.com/JollyPixel/editor/commit/6f6594d9bea483ce53f61f3c92112c727d12bb7f) Thanks [@fraxken](https://github.com/fraxken)! - Implement minimal RBAC

- [#347](https://github.com/JollyPixel/editor/pull/347) [`b568905`](https://github.com/JollyPixel/editor/commit/b56890527e918a637d41a17a7b41f1077268d04d) Thanks [@fraxken](https://github.com/fraxken)! - Improve network client API surface (reducing boilerplate required to setup a new client/connection).

- [#370](https://github.com/JollyPixel/editor/pull/370) [`36c570c`](https://github.com/JollyPixel/editor/commit/36c570cf5bef538b7c59bb64b987b86f07cc91b9) Thanks [@fraxken](https://github.com/fraxken)! - Implement a minimalist Event Store workspace

- [#364](https://github.com/JollyPixel/editor/pull/364) [`cd003c3`](https://github.com/JollyPixel/editor/commit/cd003c39463f09a0735d9a58a9ac7eea0217399d) Thanks [@fraxken](https://github.com/fraxken)! - Make the network implementation easier for workspaces

- [#418](https://github.com/JollyPixel/editor/pull/418) [`f077f50`](https://github.com/JollyPixel/editor/commit/f077f50ca679d3198e96e735b8dda1bfbf074fa5) Thanks [@fraxken](https://github.com/fraxken)! - Add `hasTransparency(rect)` to `CanvasBuffer`/`PixelBuffer`, reporting whether any pixel in a rect isn't fully opaque. Out-of-bounds cells count as transparent, matching `samplePixel(s)`'s existing convention.

- [#460](https://github.com/JollyPixel/editor/pull/460) [`142794b`](https://github.com/JollyPixel/editor/commit/142794bc2085bcf48da48a8f1fa5f1c2373b6c7f) Thanks [@fraxken](https://github.com/fraxken)! - Floating selection clipboard workflow- [#460](https://github.com/jollypixel/editor/issues/460)

- [#344](https://github.com/JollyPixel/editor/pull/344) [`b660781`](https://github.com/JollyPixel/editor/commit/b6607812584c20351ea06bc46f773b1792a08360) Thanks [@fraxken](https://github.com/fraxken)! - Improve trackpad navigation. In `"move"` mode a plain single-finger left-drag now pans the camera (no keyboard chord — the trackpad-friendly way to move around). Additionally: hold `Space` and left-drag to pan from any mode, trackpad pinch zooms toward the cursor, and wheel zoom now scales with delta magnitude (normalized across `deltaMode`) so fine-grained deltas zoom smoothly instead of jumping a full notch per event. Pan gestures (middle-drag, `Space`+drag, or a `"move"`-mode drag) show a `grab`/`grabbing` cursor.

- [#419](https://github.com/JollyPixel/editor/pull/419) [`4bb203a`](https://github.com/JollyPixel/editor/commit/4bb203ac3c7c04a2a26c6610fa062b033ceae34a) Thanks [@fraxken](https://github.com/fraxken)! - Expose `hasTransparency(rect)` on `PixelArtCanvas`, delegating to the underlying buffer, so consumers can check for transparency without reaching into private internals.

- [#361](https://github.com/JollyPixel/editor/pull/361) [`34c1d7b`](https://github.com/JollyPixel/editor/commit/34c1d7b85bdf25f89988160cfdee1edeb4f7cf2f) Thanks [@fraxken](https://github.com/fraxken)! - Re-implement the network stack

- [#359](https://github.com/JollyPixel/editor/pull/359) [`4aa7e28`](https://github.com/JollyPixel/editor/commit/4aa7e28af054ceec2656c29966c8ab6259c74007) Thanks [@fraxken](https://github.com/fraxken)! - Move the demo's Lit UI (`PixelDrawPanel`, `ModeRail`, `ColorPickerRail`, `ColorSwatch`) from `examples/` into `src/ui/`, exported as `@jolly-pixel/pixel-draw.renderer/ui`. `<pixel-draw-panel>` is now a reusable drop-in component instead of demo-only code — see `docs/ui/PixelDrawPanel.md`. `lit` and `vanilla-picker` moved from `devDependencies` to `dependencies` accordingly.

### Patch Changes

- [#446](https://github.com/JollyPixel/editor/pull/446) [`3c4a6b9`](https://github.com/JollyPixel/editor/commit/3c4a6b9951c2b7d8f4380d9bc66f1172a735f52e) Thanks [@fraxken](https://github.com/fraxken)! - Bound Selection to the canvas and fix visual artefacts with Shape selection

- [#459](https://github.com/JollyPixel/editor/pull/459) [`f4090bb`](https://github.com/JollyPixel/editor/commit/f4090bbb4abf91e5e71b0bc4400d622e752081ff) Thanks [@fraxken](https://github.com/fraxken)! - right-click armed color picking

- [#437](https://github.com/JollyPixel/editor/pull/437) [`bc16385`](https://github.com/JollyPixel/editor/commit/bc16385e3d8a2244c1d20a69424f9ffc1a6fa073) Thanks [@fraxken](https://github.com/fraxken)! - Implemented Shift+right-click line drawing with the secondary brush color.

- [#350](https://github.com/JollyPixel/editor/pull/350) [`f1ca6fa`](https://github.com/JollyPixel/editor/commit/f1ca6facc3813b2b2ffbb4b03f14537d8931e735) Thanks [@fraxken](https://github.com/fraxken)! - Revamp markdown API documentation

- Updated dependencies [[`2788a7e`](https://github.com/JollyPixel/editor/commit/2788a7e3c0d4f04ff22df415c4bd5270c3a1208a), [`6f6594d`](https://github.com/JollyPixel/editor/commit/6f6594d9bea483ce53f61f3c92112c727d12bb7f), [`1ead090`](https://github.com/JollyPixel/editor/commit/1ead09093bf7de77b56242d86693b49cae68b1e0), [`b568905`](https://github.com/JollyPixel/editor/commit/b56890527e918a637d41a17a7b41f1077268d04d), [`4309016`](https://github.com/JollyPixel/editor/commit/4309016f04d38603c713c7a1a3f5e23e6e945076), [`36c570c`](https://github.com/JollyPixel/editor/commit/36c570cf5bef538b7c59bb64b987b86f07cc91b9), [`cf91f93`](https://github.com/JollyPixel/editor/commit/cf91f9336c32d8cc709a7915d2aa2fad264403c3), [`cd003c3`](https://github.com/JollyPixel/editor/commit/cd003c39463f09a0735d9a58a9ac7eea0217399d), [`cd003c3`](https://github.com/JollyPixel/editor/commit/cd003c39463f09a0735d9a58a9ac7eea0217399d), [`53f66fa`](https://github.com/JollyPixel/editor/commit/53f66faee0df0be9c7500648c24e1f30918a8e32), [`34c1d7b`](https://github.com/JollyPixel/editor/commit/34c1d7b85bdf25f89988160cfdee1edeb4f7cf2f)]:
  - @jolly-pixel/network@1.1.0

## 2.0.0

### Major Changes

- [#313](https://github.com/JollyPixel/editor/pull/313) [`aaf89b8`](https://github.com/JollyPixel/editor/commit/aaf89b8e8a8cf33ebc0f5169a15155ad502ce71d) Thanks [@fraxken](https://github.com/fraxken)! - Major refactor of the codebase, surface APIs and documentation

- [#321](https://github.com/JollyPixel/editor/pull/321) [`a9fe312`](https://github.com/JollyPixel/editor/commit/a9fe312098ec746454616ebc19b107511f213f02) Thanks [@fraxken](https://github.com/fraxken)! - `PixelArtCanvas` (and `InputController`) no longer prefix property accessors with `get`/`set`. `getMode()`/`setMode()` → `mode`, `getFillGlobal()`/`setFillGlobal()` → `fillGlobal`, `getTextureSize()`/`setTextureSize()` → `textureSize`, `getTexture()`/`setTexture()` → `texture`, `getCamera()` → `camera`, `getZoom()` → `zoom`, `getZoomSensitivity()`/`setZoomSensitivity()` → `zoomSensitivity`, and `getParentHtmlElement()` → `parentHtmlElement` are now native `get`/`set` accessors. `getCanvas()` → `canvas()` and `getTextureCanvas()` → `textureCanvas()` are now plain methods, matching `CanvasBuffer.canvas()`/`CanvasRenderer.canvas()`. `keybindings()` → `keybindings` is now a read-only accessor; `setKeybindings(patch)` → `patchKeybindings(patch)` keeps its `set`-free verb name since it merges a partial patch rather than replacing the value (`InputController` renames the same pair identically).

- [#327](https://github.com/JollyPixel/editor/pull/327) [`6503dcc`](https://github.com/JollyPixel/editor/commit/6503dcc26cd83d66ba51491523b79260eb7145e0) Thanks [@fraxken](https://github.com/fraxken)! - Add `pickColorArmed`/`pickColorAt` to `PixelArtCanvas` for picking a color from the canvas as an addition to `"paint"` mode (arm the picker to have the next click sample a pixel into the brush color, or call `pickColorAt(x, y)` directly). Remove the right-click eyedropper — right-click no longer picks a color and is reserved for a future secondary-color action.

- [#331](https://github.com/JollyPixel/editor/pull/331) [`05346e9`](https://github.com/JollyPixel/editor/commit/05346e948b2dab70242834f3cb08499cf2173711) Thanks [@fraxken](https://github.com/fraxken)! - Extract a `Keybindings` value object (in `src/input/`) from the standalone `utils/keybindings.ts` functions. `PixelArtCanvas.keybindings` now returns this `Keybindings` instance instead of a readonly snapshot object, and `PixelArtCanvas.patchKeybindings()` is removed — use `canvas.keybindings.patch(...)` instead. The `Keybindings` record type is renamed to `KeybindingsMap` (the class now owns the `Keybindings` name).

- [#321](https://github.com/JollyPixel/editor/pull/321) [`a9fe312`](https://github.com/JollyPixel/editor/commit/a9fe312098ec746454616ebc19b107511f213f02) Thanks [@fraxken](https://github.com/fraxken)! - Renamed `CanvasManager` to `PixelArtCanvas` (and `CanvasManagerOptions` to `PixelArtCanvasOptions`) to better reflect that it's the package's top-level pixel-art canvas, not a generic manager. Update imports and type annotations accordingly; instance/variable names are unaffected.

- [#328](https://github.com/JollyPixel/editor/pull/328) [`07f689f`](https://github.com/JollyPixel/editor/commit/07f689f767f30b904606f3365a274f49c248db7c) Thanks [@fraxken](https://github.com/fraxken)! - Rework mouse bindings so left-click paints with `brush.primary` and right-click paints with `brush.secondary` (mutually exclusive strokes), with `Ctrl`+right-click as a one-shot eyedropper into `brush.primary`.

  `Brush.color()`/`colorAsString()`/`opacity` are replaced by `Brush.primary`/`Brush.secondary` (each a `BrushColor` value object with `.set()`/`.asString()`/`.opacity`), plus a new `Brush.swapColors()`. `BrushOptions.secondaryColor` seeds the initial secondary color (default white).

- [#330](https://github.com/JollyPixel/editor/pull/330) [`f409a83`](https://github.com/JollyPixel/editor/commit/f409a834ddb1f0ef59f5db62e7864dfad83a33eb) Thanks [@fraxken](https://github.com/fraxken)! - `PixelArtCanvas.zoom` now returns the `Zoom` value object (same instance as `viewport.zoom`) instead of a plain `number`, and the separate `zoomSensitivity` getter/setter has been removed. Use `.zoom.value` for the numeric level and `.zoom.sensitivity` (get/set) instead.

### Minor Changes

- [#319](https://github.com/JollyPixel/editor/pull/319) [`be8d749`](https://github.com/JollyPixel/editor/commit/be8d749274af73d4ea271b3ae66f8b08b4cea72c) Thanks [@fraxken](https://github.com/fraxken)! - Implement selection rotate and flip horizontally and vertically

- [#311](https://github.com/JollyPixel/editor/pull/311) [`58e65d5`](https://github.com/JollyPixel/editor/commit/58e65d52e2dbc9a39f3733ad31c484a6a072f0e5) Thanks [@fraxken](https://github.com/fraxken)! - Implement new select mode to move, copy and delete selected rectangle area

- [#316](https://github.com/JollyPixel/editor/pull/316) [`72d9141`](https://github.com/JollyPixel/editor/commit/72d91413d5a2e78b5d769d6c633743627ed9441e) Thanks [@fraxken](https://github.com/fraxken)! - Implement redo/undo with CTRL+Z and CTRL+Y

- [#312](https://github.com/JollyPixel/editor/pull/312) [`a9e412a`](https://github.com/JollyPixel/editor/commit/a9e412a6933a84fbecf390483ea35c857acec926) Thanks [@fraxken](https://github.com/fraxken)! - Fixing Input collisions across the workspaces

- [#305](https://github.com/JollyPixel/editor/pull/305) [`b9ad869`](https://github.com/JollyPixel/editor/commit/b9ad869dd35a600531d5be48bbbcc871e47473ed) Thanks [@fraxken](https://github.com/fraxken)! - Enhance InputController with injectable WindowLike and improve isEditableTarget to avoid unfocus draw line

- [#325](https://github.com/JollyPixel/editor/pull/325) [`4e4c65f`](https://github.com/JollyPixel/editor/commit/4e4c65f4019810c1f9926e04f406d0d0111575bb) Thanks [@fraxken](https://github.com/fraxken)! - Implement Shape Selection

- [#302](https://github.com/JollyPixel/editor/pull/302) [`c871891`](https://github.com/JollyPixel/editor/commit/c871891c93a5531fddbcf6282d08db8077012ce2) Thanks [@fraxken](https://github.com/fraxken)! - Remove dead code, rename utils.ts to colors.ts and refactor Objects with better usage of Color class.

- [#306](https://github.com/JollyPixel/editor/pull/306) [`e5cd914`](https://github.com/JollyPixel/editor/commit/e5cd914b6c2969360f9d2edd8e1c909119f451c9) Thanks [@fraxken](https://github.com/fraxken)! - Holding shift to continue drawing new line

- [#329](https://github.com/JollyPixel/editor/pull/329) [`e47e750`](https://github.com/JollyPixel/editor/commit/e47e750d0ec39191e512e43bacb2d297dfedb591) Thanks [@fraxken](https://github.com/fraxken)! - Update API documentation and codebase comments

- [#307](https://github.com/JollyPixel/editor/pull/307) [`7c2a32d`](https://github.com/JollyPixel/editor/commit/7c2a32d2333f8ab55141ada503d6a4851720b9c7) Thanks [@fraxken](https://github.com/fraxken)! - Add a paint-bucket fill mode: set `mode: "fill"` and left-click flood-fills the 4-directionally connected region of same-colored pixels with the current brush color/opacity. New `FillTool` class implements the algorithm; `PixelArtCanvas.commitLine` is renamed to `commitPixels` (now used by both the line and fill tools); `InputActions` gains a required `onFillStart` method. `CanvasBuffer.drawPixels` now syncs its canvas mirror with a single bounding-box `putImageData` call instead of one per pixel, benefiting any large stroke.

- [#328](https://github.com/JollyPixel/editor/pull/328) [`07f689f`](https://github.com/JollyPixel/editor/commit/07f689f767f30b904606f3365a274f49c248db7c) Thanks [@fraxken](https://github.com/fraxken)! - `"fill"` mode now routes right-click to the same flood/global fill as left-click, but painted with `brush.secondary` instead of `brush.primary`. `PixelArtCanvas.commitPixels(pixels, slot?)` gained an optional `BrushColorSlot` parameter (defaults to `"primary"`, so existing calls are unaffected).

- [#304](https://github.com/JollyPixel/editor/pull/304) [`2e01373`](https://github.com/JollyPixel/editor/commit/2e01373276c38c02759229ece5a14a98157f2849) Thanks [@fraxken](https://github.com/fraxken)! - Add Shift-to-line drawing tool in paint mode: holding Shift previews a brush-stamped, rasterized straight line via the SVG overlay, committed as a single history entry on mousedown/mouseup.

- [#332](https://github.com/JollyPixel/editor/pull/332) [`b6874d9`](https://github.com/JollyPixel/editor/commit/b6874d9d5c682d1aa038e4eae54b0905eea8a2fc) Thanks [@fraxken](https://github.com/fraxken)! - Fix a select-mode regression where moving, deleting, or rotating/flipping a selection vacated its footprint with a flat erase color (fully transparent by default), leaving a jarring hole the size of the whole selection rectangle instead of just the drawn content. The vacated footprint is now filled with the most common color among its surrounding pixels, blending into the artwork; `select.eraseColor` still works as an explicit override, and falls back to fully transparent only when no in-bounds neighbors exist.

- [#257](https://github.com/JollyPixel/editor/pull/257) [`5d78456`](https://github.com/JollyPixel/editor/commit/5d784561fbcd06c13a8c47259b2a09745e40bfdf) Thanks [@fraxken](https://github.com/fraxken)! - Implement new methods to destroy, better viewport resize and texture update

- [#320](https://github.com/JollyPixel/editor/pull/320) [`1675e4f`](https://github.com/JollyPixel/editor/commit/1675e4fb7f5f3bc19d1a37ae241b2f8be10d919a) Thanks [@fraxken](https://github.com/fraxken)! - Fill mode now shows the SVG brush-cursor highlight (forced to a single pixel, ignoring `brush`'s configured size) and supports right-click color pick, matching paint mode. Added the `PixelArtCanvas.fillGlobal` accessor (runtime-only, no constructor option): when enabled, a fill click recolors every pixel matching the seed's color anywhere on the canvas instead of only its 4-directionally connected region. `Fill.matchAll` implements the whole-canvas scan. A global fill is broadcast/history-recorded via a new compact `"global-fill"` `PixelBufferHookEvent`/network action (`{ fromColor, toColor }`, no position list) that every applier (`PixelArtCanvas.applyRemoteCommand`, `PixelCommandApplier.applyCommandToWorld`) recomputes locally; it bypasses `PixelSyncServer`'s per-pixel conflict resolution (always accepted, like `"resized"`/`"texture-replaced"`). Local undo/redo of a global fill stays exact via the ordinary `"stroke"` history entry, but re-broadcasts as a full-position `"stroke"` event rather than the compact form.

- [#317](https://github.com/JollyPixel/editor/pull/317) [`20818e2`](https://github.com/JollyPixel/editor/commit/20818e22a0767b7d7da04197747bde559b77ead5) Thanks [@fraxken](https://github.com/fraxken)! - Make the copy/paste/undo/redo/delete keyboard shortcuts configurable via `PixelArtCanvasOptions.keybindings`, `PixelArtCanvas.patchKeybindings()`/`keybindings`. Matching now uses `KeyboardEvent.code` instead of `.key`, so shortcuts work consistently across keyboard layouts (e.g. AZERTY). As a minor side effect, matching is now exact on modifiers — Ctrl+Shift+C no longer also triggers copy, and Ctrl+Delete no longer also triggers delete.

- [#324](https://github.com/JollyPixel/editor/pull/324) [`e8c933f`](https://github.com/JollyPixel/editor/commit/e8c933f625dd17428a773c4d566631cbcd06d179) Thanks [@fraxken](https://github.com/fraxken)! - Add a `backgroundColor` option/property to `PixelArtCanvas`, letting callers set the canvas void color explicitly instead of relying solely on the parent element's inferred CSS `background-color`

- [#333](https://github.com/JollyPixel/editor/pull/333) [`6ce636d`](https://github.com/JollyPixel/editor/commit/6ce636d7903f699c10bfbf9240be69e837d690b1) Thanks [@fraxken](https://github.com/fraxken)! - Add a `"uv"` mode for placing rectangular UV regions on a texture, independently of painting. The canvas cursor is `"grab"`/`"grabbing"` while idle/dragging in this mode. `PixelArtCanvas.uv` exposes a new `UVMap` value object: `create({ width, height })` (API-only, no canvas gesture), `delete(id)`, `move(id, rect)`, and `select(id)`, with a typed event emitter (`region-created`/`region-deleted`/`region-moved`/`region-dragging`/`selection-changed`/`visibility-changed`). `region-dragging` fires continuously while a canvas drag is in progress (via `previewMove`), uncommitted and never recorded/broadcast, so a consumer can mirror the region live instead of only on drop. Regions are hidden by default — visible only when selected or when `showAll` is enabled — and render as solid colored borders. Region create/delete/move participate in undo/redo (`HistoryEntry` gains `"uv-create"`/`"uv-delete"`/`"uv-move"`) and in network sync (`PixelBufferHookEvent` gains `"uv-region-created"`/`"uv-region-deleted"`/`"uv-region-moved"`; `PixelSyncServer` resolves move/delete conflicts per region id, and `PixelBufferSnapshot` now carries `uvRegions` for late-joining clients). See `docs/uv/UVMap.md`.

### Patch Changes

- [#326](https://github.com/JollyPixel/editor/pull/326) [`e62b62c`](https://github.com/JollyPixel/editor/commit/e62b62c15e04a2762ef780242b3e6924b8c2818f) Thanks [@fraxken](https://github.com/fraxken)! - Default `select.eraseColor` to fully transparent instead of opaque white, matching the erase/delete behavior of most pixel-art editors.

- [#333](https://github.com/JollyPixel/editor/pull/333) [`6ce636d`](https://github.com/JollyPixel/editor/commit/6ce636d7903f699c10bfbf9240be69e837d690b1) Thanks [@fraxken](https://github.com/fraxken)! - `PixelArtCanvas`'s default zoom (when `zoom.default` is omitted) now fits the whole texture inside the container's initial size, instead of a flat `4` — a large texture in a small container no longer starts zoomed in past what's visible. Pass an explicit `zoom.default` to opt out.

- [#333](https://github.com/JollyPixel/editor/pull/333) [`6ce636d`](https://github.com/JollyPixel/editor/commit/6ce636d7903f699c10bfbf9240be69e837d690b1) Thanks [@fraxken](https://github.com/fraxken)! - `"select"` mode now shows the same `"grab"`/`"grabbing"` cursor affordance as `"uv"` mode: `"grab"` once a selection exists (idle), `"grabbing"` while it's being dragged to a new position. Drawing a brand-new rectangle keeps the plain cursor, since that isn't a grab motion.

- [#323](https://github.com/JollyPixel/editor/pull/323) [`61f9547`](https://github.com/JollyPixel/editor/commit/61f9547c9bd3fc1eb183b7b903ce2f0bd4af4ba0) Thanks [@fraxken](https://github.com/fraxken)! - Select tool: a plain click (no drag) no longer creates a degenerate 1x1 selection — the drag must grow past its starting pixel to commit.

- [#308](https://github.com/JollyPixel/editor/pull/308) [`96cf210`](https://github.com/JollyPixel/editor/commit/96cf2103a6d89a550a46aed9f57a4c46414e3c6d) Thanks [@fraxken](https://github.com/fraxken)! - Fixing backgroundColor in PixelArtCanvas when zooming In/Out

- [#333](https://github.com/JollyPixel/editor/pull/333) [`6ce636d`](https://github.com/JollyPixel/editor/commit/6ce636d7903f699c10bfbf9240be69e837d690b1) Thanks [@fraxken](https://github.com/fraxken)! - Fix undo/redo reactivating the selection overlay after leaving select mode: a select-edit history entry now only resyncs the selection (and its SVG overlay) when select mode is currently active, while pixels still restore regardless of mode.
