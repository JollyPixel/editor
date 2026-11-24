# @jolly-pixel/pixel-draw.renderer

## 9.0.0

### Major Changes

- [#1195](https://github.com/JollyPixel/editor/pull/1195) [`033a975`](https://github.com/JollyPixel/editor/commit/033a975db5003d093263c9f9820c0fde7b00ff39) Thanks [@fraxken](https://github.com/fraxken)! - Binary frames are compressed only when the sender asks, through `SendOptions { compress }`, which replaces `compression.binary`. `PngPixels.data` is now a `Uint8Array`.

- [#1164](https://github.com/JollyPixel/editor/pull/1164) [`505d6e0`](https://github.com/JollyPixel/editor/commit/505d6e0444dc3bc5bcb365486f085c169eb2caa8) Thanks [@fraxken](https://github.com/fraxken)! - Palettes hold 1 to 256 colours (`COLOR_PALETTE_MAX_SIZE` replaces `COLOR_PALETTE_SIZE`), brushes get an `ink` mode, and the colour picker adds OKHSL and an eyedropper.

- [#1195](https://github.com/JollyPixel/editor/pull/1195) [`00f50e5`](https://github.com/JollyPixel/editor/commit/00f50e5af2be1dcb0d11a6731330ffb823a6f802) Thanks [@fraxken](https://github.com/fraxken)! - `PixelCommand`'s `texture-replaced` carries its pixels as a `Uint8Array` instead of base64; `toPixelCommand` and `toPixelDocumentCommand` copy the bytes.

- [#1092](https://github.com/JollyPixel/editor/pull/1092) [`78ea67b`](https://github.com/JollyPixel/editor/commit/78ea67bc7a2636cdea144fe2c64efa0b5e228346) Thanks [@fraxken](https://github.com/fraxken)! - UV nets are saved with the texture and synced with peers. `PixelDocument.loadSnapshot()` takes one `PixelDocumentSnapshot` object.

- [#1209](https://github.com/JollyPixel/editor/pull/1209) [`6268c47`](https://github.com/JollyPixel/editor/commit/6268c4717783c25bda4ab5542b1c32959c18da39) Thanks [@fraxken](https://github.com/fraxken)! - UV regions can be mirrored (`UVMap.mirror()`). Rename `"region-rotated"` to `"region-reoriented"`, `restoreRotation()` to `restoreOrientation()` and `UVRegionRotation` to `UVRegionOrientation`.

### Minor Changes

- [#1091](https://github.com/JollyPixel/editor/pull/1091) [`383ef85`](https://github.com/JollyPixel/editor/commit/383ef85a2435ce0c6bd819c43402ba0d4374e5d2) Thanks [@fraxken](https://github.com/fraxken)! - Edge-pan the view while a selection or UV drag reaches the canvas edge, and keep a drag under the cursor when the view pans or zooms.

- [#1160](https://github.com/JollyPixel/editor/pull/1160) [`7ddc912`](https://github.com/JollyPixel/editor/commit/7ddc91235d9fd536e43c317f092620fb15bd63c7) Thanks [@fraxken](https://github.com/fraxken)! - A `UVRect` can set `mirrored` to flip its face left to right before `rotation`; `geometryMirrored()` reads it, and moves, resizes and turns keep it.

### Patch Changes

- [#1166](https://github.com/JollyPixel/editor/pull/1166) [`1172e00`](https://github.com/JollyPixel/editor/commit/1172e00ffa43d52a158fdf48ec47550cb856da6b) Thanks [@fraxken](https://github.com/fraxken)! - Add the immutable `Color` object and `Gradient`, which replace the `parseColor`, `format*`, mixing and ramp functions. Near-gray colours now convert as grays.

- [#1231](https://github.com/JollyPixel/editor/pull/1231) [`40b7a52`](https://github.com/JollyPixel/editor/commit/40b7a52eb6d394cfb4959aeb07abe807fb599bb0) Thanks [@fraxken](https://github.com/fraxken)! - `PixelDocument` builds without a DOM: its buffer creates the working canvas on the first `canvas()` call. A canvas loaded with `loadTexture()` now also has image smoothing off.
- Updated dependencies [[`1172e00`](https://github.com/JollyPixel/editor/commit/1172e00ffa43d52a158fdf48ec47550cb856da6b), [`505d6e0`](https://github.com/JollyPixel/editor/commit/505d6e0444dc3bc5bcb365486f085c169eb2caa8)]:
  - @jolly-pixel/color@3.0.0

## 8.0.0

### Major Changes

- [#1069](https://github.com/JollyPixel/editor/pull/1069) [`176b005`](https://github.com/JollyPixel/editor/commit/176b005c86d6d2e62e6d03780d26cf6f770e2650) Thanks [@fraxken](https://github.com/fraxken)! - Rename `createDocument(room)` to `syncDocument(room)`, `InvalidAssetDocumentError` to `InvalidAssetFileError`, `ProjectFile.document` to `ProjectFile.data`, and the `.pixelart` codec to `PixelArtFile`.

- [#924](https://github.com/JollyPixel/editor/pull/924) [`f174add`](https://github.com/JollyPixel/editor/commit/f174addea4b885bd601976b7fd730a91a0b047c4) Thanks [@fraxken](https://github.com/fraxken)! - `CommandDocument`, `ChangeReceipts` and `CommandHistory` move to the new `@jolly-pixel/history` package. The renderers no longer own undo: `PixelArtCanvas` takes a history from the host, and `VoxelHistory` is removed.

- [#1024](https://github.com/JollyPixel/editor/pull/1024) [`9123c45`](https://github.com/JollyPixel/editor/commit/9123c4578d791cb8f9d3749e56d2c8268ee87ec7) Thanks [@fraxken](https://github.com/fraxken)! - Rename methods named `xOf`, `xFor` or `getX`/`setX` after what they do (for example `inverseOf` → `invert`, `UVRegion.rectFor` → `slotRect`, `MessageParser.of` → `fromProtocol`).
  The package docs list the new names; behavior is unchanged.

- [#883](https://github.com/JollyPixel/editor/pull/883) [`6931384`](https://github.com/JollyPixel/editor/commit/69313842464ca9610f0448e7e76629e3ff3a213d) Thanks [@fraxken](https://github.com/fraxken)! - History, remote edits and state share one reversible `PixelCommand` model: listen to the `command` event instead of `buffer-updated`. UV regions are stacked, net or free, and `withRect` becomes `movedTo`.

- [#1041](https://github.com/JollyPixel/editor/pull/1041) [`352a9e8`](https://github.com/JollyPixel/editor/commit/352a9e88bb3c14fea5d059f12667ce37b770f865) Thanks [@fraxken](https://github.com/fraxken)! - UV net cells can hold several slots sharing one rectangle, and `UVMap.unfold(id, net?)` lays a region out again through any net.

### Minor Changes

- [#990](https://github.com/JollyPixel/editor/pull/990) [`4e6f3f2`](https://github.com/JollyPixel/editor/commit/4e6f3f297144e5bee51734b83ec5fe6a22cc3ea7) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - Add the `"silhouette"` highlight technique for any mesh. UV regions with triangle or compound faces can be resized; `UVRegion.resizable` is removed.

- [#1083](https://github.com/JollyPixel/editor/pull/1083) [`d866130`](https://github.com/JollyPixel/editor/commit/d86613035c5f949c9449ce152bd5a8bcd570bac5) Thanks [@fraxken](https://github.com/fraxken)! - Add OKLCH, OKHSV and OKHSL colour spaces, harmonies and `ColorSequence` (which replaces `ColorPalette`), plus a configurable `jolly-color-picker`.

- [#867](https://github.com/JollyPixel/editor/pull/867) [`f03cb7a`](https://github.com/JollyPixel/editor/commit/f03cb7a89b574ba6965f3b88d0ad5796de6cbdce) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - Rooms broadcast a fresh snapshot when an asset changes on disk, and peers' UV selections are outlined. Truncated UI labels show their full text on hover, and narrow tab strips collapse to icons.

- [#894](https://github.com/JollyPixel/editor/pull/894) [`a69599d`](https://github.com/JollyPixel/editor/commit/a69599d95ccbbca488aa7160d969033b24307340) Thanks [@fraxken](https://github.com/fraxken)! - Add `canvas.shortcuts.selectAll()` to select the entire texture in Select mode.
  Preserve floating pastes and use current texture bounds, including 1×1 textures.

- [#862](https://github.com/JollyPixel/editor/pull/862) [`5563478`](https://github.com/JollyPixel/editor/commit/55634788aa98ea5616d9b2e3c58c3f6987b94f19) Thanks [@fraxken](https://github.com/fraxken)! - Add normal maps: pixel-draw derives a synced, undoable normal map per UV island, and voxel-renderer lights blocksets with it, scaled by `MaterialGroup.normalScale`.

- [#894](https://github.com/JollyPixel/editor/pull/894) [`a031790`](https://github.com/JollyPixel/editor/commit/a031790a29618b165a8566e37f846219ebbd9864) Thanks [@fraxken](https://github.com/fraxken)! - Add a ten-color RGBA8 palette to Pixel Documents, serialized in files and snapshots.
  Palette slot commands support undo/redo and remote application; older documents load defaults.

- [#916](https://github.com/JollyPixel/editor/pull/916) [`7b98310`](https://github.com/JollyPixel/editor/commit/7b9831087622af584e8415820e988376d7668c34) Thanks [@fraxken](https://github.com/fraxken)! - Holding the line modifier (usually `Shift`) while dragging a UV region also moves the regions nested inside it, as one undo step.

- [#894](https://github.com/JollyPixel/editor/pull/894) [`b6044f6`](https://github.com/JollyPixel/editor/commit/b6044f6164dab2857268f859c642cfb384098dbb) Thanks [@fraxken](https://github.com/fraxken)! - Expose undo and redo step counts: `HistoryState` gains `undoDepth` and `redoDepth`, and `PixelArtCanvas` adds `undoDepth()` and `redoDepth()`.

- [#953](https://github.com/JollyPixel/editor/pull/953) [`cb97596`](https://github.com/JollyPixel/editor/commit/cb975969e2052ae274ecbdd556ba23da2a9f4092) Thanks [@fraxken](https://github.com/fraxken)! - `PixelArtCanvas.pixelsLocked` makes pixels read-only in every texture view, for hosts whose user has no right to write them.

- [#905](https://github.com/JollyPixel/editor/pull/905) [`26b8b55`](https://github.com/JollyPixel/editor/commit/26b8b551d00aa70ea11b7b7e0097f70c1da43dc3) Thanks [@fraxken](https://github.com/fraxken)! - Export the `RectArea` value object and add `RectArea.intersects(rect)` for strict rectangle overlap checks.

- [#1040](https://github.com/JollyPixel/editor/pull/1040) [`5398d19`](https://github.com/JollyPixel/editor/commit/5398d195e9f8c65a3b52916917f31a415f0b1e84) Thanks [@fraxken](https://github.com/fraxken)! - Add `canvas.grid` (`TextureGrid`, `grid` option): cell lines drawn over the texture, and UV move and resize drags that snap to them while `grid.snap` is on.
  `CanvasShortcuts.snapBypassHeld` turns snapping off for the current drag.

- [#895](https://github.com/JollyPixel/editor/pull/895) [`9c05ae3`](https://github.com/JollyPixel/editor/commit/9c05ae3b4c5934521a6608a193eb87b43f8ab56c) Thanks [@fraxken](https://github.com/fraxken)! - A touchpad pinch zooms in paint and erase modes, and only `Ctrl`+wheel resizes the brush.

- [#858](https://github.com/JollyPixel/editor/pull/858) [`d72dd94`](https://github.com/JollyPixel/editor/commit/d72dd94be9788d77af1b9b8e027b8a77887ebcce) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - Add `UVMap.labelScope` (`"all" | "selected"`) to label only the selected UV region while keeping every border visible.

- [#949](https://github.com/JollyPixel/editor/pull/949) [`16a1a20`](https://github.com/JollyPixel/editor/commit/16a1a20835b29f849ecb29fa42df5c2ae24ae898) Thanks [@fraxken](https://github.com/fraxken)! - Add `UVNet` to choose how a UV region unfolds: `UVNet.packed` (the default) or a fixed grid of slots, through `UVRegion.unfold(net)` and the `UVMap.net` property.

- [#853](https://github.com/JollyPixel/editor/pull/853) [`9639459`](https://github.com/JollyPixel/editor/commit/963945920d90416d0c085c1d1e80e533c8155c3f) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - Add UV resize handles (`uv.resizable`, `UVMap.resize()`). `"region-dragging"` now carries the previewed `region` for moves and resizes, and `PeerUVPreviewState` holds a `region`.

- [#887](https://github.com/JollyPixel/editor/pull/887) [`75e537e`](https://github.com/JollyPixel/editor/commit/75e537e8514f111c94b2a0116a903ddd41689baa) Thanks [@fraxken](https://github.com/fraxken)! - Add corner handles to resize rectangular selections without changing texture pixels.
  Selection resizing supports pixel snapping, texture clipping and outline previews.

- [#887](https://github.com/JollyPixel/editor/pull/887) [`8dd3b8c`](https://github.com/JollyPixel/editor/commit/8dd3b8c0bc7d5391feef932659c8b6dccaa00f3d) Thanks [@fraxken](https://github.com/fraxken)! - Expose immutable selection presence snapshots and lifecycle notifications.
  Keep peer selections visible through commits and synchronize exact floating pixels.

- [#952](https://github.com/JollyPixel/editor/pull/952) [`0cac137`](https://github.com/JollyPixel/editor/commit/0cac13766e6a2d3b4fb88225de64d93b8b14ee48) Thanks [@fraxken](https://github.com/fraxken)! - Add `UVMap.overflow` so UV regions can extend past the texture edge, up to a limit.

- [#896](https://github.com/JollyPixel/editor/pull/896) [`e4b2279`](https://github.com/JollyPixel/editor/commit/e4b2279323d49cc3afd36b32e0f9f1538a11d7a5) Thanks [@fraxken](https://github.com/fraxken)! - `UVMap.showSizeLabels` (event `"size-label-visibility-changed"`) shows the selected UV target size in texture pixels, like the selection size, moving inside when it would cover another UV; net faces show it inside.

### Patch Changes

- [#1016](https://github.com/JollyPixel/editor/pull/1016) [`5df8953`](https://github.com/JollyPixel/editor/commit/5df89531ef26fe891a7ef5ed6144ea8dc2155bee) Thanks [@fraxken](https://github.com/fraxken)! - `encodePng` takes an optional row `filter`, shrinking tileset snapshots by about 40%. Base64 uses native APIs and `js-base64` is dropped.

- [#1041](https://github.com/JollyPixel/editor/pull/1041) [`20069c8`](https://github.com/JollyPixel/editor/commit/20069c8f3d41ab7c6ccaf94faef678af6a2f4814) Thanks [@fraxken](https://github.com/fraxken)! - Clicking a stack of coincident UV slots now cycles on release instead of on press, so pressing the selected slot and dragging moves it.

- [#948](https://github.com/JollyPixel/editor/pull/948) [`4ba669b`](https://github.com/JollyPixel/editor/commit/4ba669bba56017f7079f482c863cfcdcd0fcae3f) Thanks [@fraxken](https://github.com/fraxken)! - UV resize handles only show in UV mode, so other modes no longer draw handles they cannot use.

- [#885](https://github.com/JollyPixel/editor/pull/885) [`7e4b438`](https://github.com/JollyPixel/editor/commit/7e4b4386d9b5d4a12869335ed6863653a2897a46) Thanks [@fraxken](https://github.com/fraxken)! - Start Shift lines from the last paint or erase click and retain the line anchor across Shift presses.
  Use the first available cursor position when no line anchor exists.

- [#887](https://github.com/JollyPixel/editor/pull/887) [`9478d49`](https://github.com/JollyPixel/editor/commit/9478d4912aab2584e9be07ed7c0c33432e45a130) Thanks [@fraxken](https://github.com/fraxken)! - Hide UV resize handles and block new move and resize gestures while a peer previews that region.
  Announce UV gestures on pointer-down and restore handles when the final peer preview clears.
- Updated dependencies [[`d866130`](https://github.com/JollyPixel/editor/commit/d86613035c5f949c9449ce152bd5a8bcd570bac5), [`09eabd6`](https://github.com/JollyPixel/editor/commit/09eabd676125ee69ac8e823815c62fd01b4feb5a), [`797aeb9`](https://github.com/JollyPixel/editor/commit/797aeb960560778e6f71219197859bb001f2045a), [`5df8953`](https://github.com/JollyPixel/editor/commit/5df89531ef26fe891a7ef5ed6144ea8dc2155bee)]:
  - @jolly-pixel/color@2.0.0
  - @jolly-pixel/image@2.1.0

## 7.0.0

### Major Changes

- [#833](https://github.com/JollyPixel/editor/pull/833) [`f54d006`](https://github.com/JollyPixel/editor/commit/f54d006a7c16e9d2cca6cf6fec6076053ac86335) Thanks [@fraxken](https://github.com/fraxken)! - Keyboard handling moves to the host through `PixelArtCanvas.shortcuts`; the `keybindings` option and the `Keybindings` exports are removed.

### Minor Changes

- [#845](https://github.com/JollyPixel/editor/pull/845) [`399e1e4`](https://github.com/JollyPixel/editor/commit/399e1e448a7cab33990ccb000c381ec266060de5) Thanks [@fraxken](https://github.com/fraxken)! - Add `renderOnDemand` to `Runtime`: the loop sleeps when nothing changes, and cameras, voxel views and peer syncs request the frames they need. Room joins load a much smaller snapshot.

- [#802](https://github.com/JollyPixel/editor/pull/802) [`5d415e4`](https://github.com/JollyPixel/editor/commit/5d415e4f680fd90ba0ec3819b018baa5c59382fe) Thanks [@fraxken](https://github.com/fraxken)! - Asset rooms resend a snapshot to the author of a refused command, and `CommandSync` adds `whenReady()`. `PixelDocument` emits `buffer-updated`.

- [#788](https://github.com/JollyPixel/editor/pull/788) [`4a6ffd0`](https://github.com/JollyPixel/editor/commit/4a6ffd0841535389f5c61246cbf8d5b45d9f408e) Thanks [@fraxken](https://github.com/fraxken)! - Add `UVRegion.toLayout()` and `UVRegion.fromLayout(layout, identity)`, with the `UVLayoutData` and `UVRegionIdentity` types, to split a UV region's geometry from its identity.

- [#786](https://github.com/JollyPixel/editor/pull/786) [`482d8b7`](https://github.com/JollyPixel/editor/commit/482d8b7d9462d8cd57ee09e21f4d650d9f7cbc17) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - `exportAssetArchive` rejects unreadable assets instead of writing an archive that import refuses. UV regions can be owned by another document, and the UV geometry helpers are exported.

### Patch Changes

- Updated dependencies [[`b19efe6`](https://github.com/JollyPixel/editor/commit/b19efe62f02a41cccb67a846c7066d6bf3337c76), [`b520e7e`](https://github.com/JollyPixel/editor/commit/b520e7e37c000763a492f68635af528ca461a285)]:
  - @jolly-pixel/image@2.0.0
  - @jolly-pixel/color@1.1.1

## 6.0.0

### Major Changes

- [#723](https://github.com/JollyPixel/editor/pull/723) [`4c3de3b`](https://github.com/JollyPixel/editor/commit/4c3de3b110acdb9642ca70798d7d12e3d66e2967) Thanks [@fraxken](https://github.com/fraxken)! - Wheel zoom is eased around the cursor and snaps near whole levels. `zoom.sensitivity` is now the relative change per notch (default `0.25`).

### Minor Changes

- [#725](https://github.com/JollyPixel/editor/pull/725) [`9e4b7a1`](https://github.com/JollyPixel/editor/commit/9e4b7a16d5348458027d06eafc68baf51ca4f519) Thanks [@fraxken](https://github.com/fraxken)! - Track dependencies between assets in the catalog. Tilesets can point at a pixel-art `asset`, and several `PixelArtCanvas` can share one headless `PixelDocument`.

- [#765](https://github.com/JollyPixel/editor/pull/765) [`f92e245`](https://github.com/JollyPixel/editor/commit/f92e2453211663158b04606da2008ba25cc35529) Thanks [@fraxken](https://github.com/fraxken)! - Add `Runtime.nextFrame()`/`frames(count)`, `VoxelEngine.whenIdle()`, `projectToClient()` in three,
  and `textureClientPosition()` on the pixel-draw canvas viewport (typed `CanvasViewport`).

- [#719](https://github.com/JollyPixel/editor/pull/719) [`3fa7340`](https://github.com/JollyPixel/editor/commit/3fa7340724862619d60dc63df0564a2e87333ae2) Thanks [@fraxken](https://github.com/fraxken)! - A ramp slope with its own tile now samples its true `√2` length (16 by 23 texels on 16-texel tiles) through the new `TileSpan`; shared `defaultTexture` tiles stay square.
  `UVSlotGeometryTemplate` accepts a per-slot `width` and `height`.

- [#728](https://github.com/JollyPixel/editor/pull/728) [`d97c85d`](https://github.com/JollyPixel/editor/commit/d97c85d6920ed5708385f6e78095835f307187db) Thanks [@fraxken](https://github.com/fraxken)! - Add `UVMap.rename()` and `UVRegion.renamed()` to rename a UV region in place.
  The voxel-model editor uses it to keep a block's UV label in sync with its name.

- [#721](https://github.com/JollyPixel/editor/pull/721) [`710542c`](https://github.com/JollyPixel/editor/commit/710542c574f803f405bec2b5d9270b5f4e83898d) Thanks [@fraxken](https://github.com/fraxken)! - UV regions can be rotated by 90° (`UVMap.rotate()`, `R`/`Shift+R`), and `ResolvedTileRef.rotation` turns a tile inside its face.

### Patch Changes

- [#720](https://github.com/JollyPixel/editor/pull/720) [`749d1ea`](https://github.com/JollyPixel/editor/commit/749d1ea50c7e646b0ed446f16975471da4946a23) Thanks [@fraxken](https://github.com/fraxken)! - Reframe the texture when a canvas or texture resize makes it start or stop
  fitting, so a grow then shrink no longer pushes it out of view.

## 5.0.0

### Major Changes

- [#639](https://github.com/JollyPixel/editor/pull/639) [`55a1230`](https://github.com/JollyPixel/editor/commit/55a12309b7e3d4a3c7ba7efc47766655abaf10f9) Thanks [@fraxken](https://github.com/fraxken)! - Authenticate connections at the WebSocket handshake through an `AuthenticationProvider`. The client's `identity` becomes the untrusted `profile`, and roles missing from a rights table are denied.

- [#661](https://github.com/JollyPixel/editor/pull/661) [`c0195cb`](https://github.com/JollyPixel/editor/commit/c0195cb7a44ae85c1131e406d1a97a79c1247a4f) Thanks [@fraxken](https://github.com/fraxken)! - Move pixel-art persistence and collaboration into `@jolly-pixel/asset.pixel-art`.
  Remove the renderer's `/asset` and `/network` exports.

### Minor Changes

- [#670](https://github.com/JollyPixel/editor/pull/670) [`4d1b598`](https://github.com/JollyPixel/editor/commit/4d1b5985751cf7ac88539a6ee91a58f3affc218c) Thanks [@fraxken](https://github.com/fraxken)! - Add `FillTool.uvClip` to keep a fill inside or outside UV slots, and `clearTexture({ includeUV })`, which keeps UV slot pixels by default.

- [#689](https://github.com/JollyPixel/editor/pull/689) [`81f9fcc`](https://github.com/JollyPixel/editor/commit/81f9fcc003a62bb102e5f0cfb4cf439165778ccf) Thanks [@fraxken](https://github.com/fraxken)! - Tilesets are declared on the world (`engine.tilesets`), and `VoxelEngine` emits one `"command"` event that replaces the per-change callbacks. Add the browser `CatalogClient`.

- [#701](https://github.com/JollyPixel/editor/pull/701) [`40a459c`](https://github.com/JollyPixel/editor/commit/40a459c9a536c6d5304c4549eb5f390e3644bf7a) Thanks [@fraxken](https://github.com/fraxken)! - Export `encodePixelBytes` and `decodePixelBytes`, the base64 codec used for a
  document's `pixels` field, so consumers reading or writing that field no longer
  need their own base64 dependency.

- [#672](https://github.com/JollyPixel/editor/pull/672) [`a6c9c55`](https://github.com/JollyPixel/editor/commit/a6c9c5571dae0bf02bdd56c57ef1cd4f6acf7eee) Thanks [@fraxken](https://github.com/fraxken)! - `UVMap.showAll` no longer forces region labels; `showRegionLabels` alone controls them.

### Patch Changes

- [#659](https://github.com/JollyPixel/editor/pull/659) [`853c83b`](https://github.com/JollyPixel/editor/commit/853c83b9070a249087dab57247bc8dad0605b781) Thanks [@fraxken](https://github.com/fraxken)! - Remove the unused `sync`, `catalog`, `rooms`, `static` and `workspace` subpath exports; import from the package root instead.
  Add a `kinds` entry exposing the asset kind handler contract, used by the renderer asset handlers.

- [#682](https://github.com/JollyPixel/editor/pull/682) [`04d3b3b`](https://github.com/JollyPixel/editor/commit/04d3b3b55b00bfa37599d6d40f568ada7055eea2) Thanks [@fraxken](https://github.com/fraxken)! - `centerTexture()` anchors a texture larger than the viewport to its top-left corner, one axis at a time, instead of centering it.
  Resizing keeps that anchor on overflowing axes instead of shifting the camera by half the size change.
- Updated dependencies [[`ab65462`](https://github.com/JollyPixel/editor/commit/ab65462597390541cdb2bee98a7aa22dff562c69)]:
  - @jolly-pixel/color@1.1.0

## 4.0.0

### Major Changes

- [#618](https://github.com/JollyPixel/editor/pull/618) [`d6b2a37`](https://github.com/JollyPixel/editor/commit/d6b2a37da51adcbfc84267c5276958299f58eb7b) Thanks [@fraxken](https://github.com/fraxken)! - Asset kinds describe a declarative `live()` protocol instead of a room extension; `PixelArtAssetExtension` and `VoxelMapAssetExtension` are removed.

- [#608](https://github.com/JollyPixel/editor/pull/608) [`ad9861d`](https://github.com/JollyPixel/editor/commit/ad9861dedfc2839f1dba4d6ae496f40737682fc7) Thanks [@fraxken](https://github.com/fraxken)! - Replace face-named UV APIs with slot-named ones (`DEFAULT_UV_SLOTS`, `slots`, `slotsOf()`, `selectedSlot`); saved regions keep their format.

- [#550](https://github.com/JollyPixel/editor/pull/550) [`e282c08`](https://github.com/JollyPixel/editor/commit/e282c08f6857bc99dc33f343a831395d0e8716fd) Thanks [@fraxken](https://github.com/fraxken)! - Rename `PixelCursorSyncOptions.getLabel` to `label` and add a `color` callback,
  so a host can key peer cursor colors on a stable identity field instead of the
  per-connection `clientId`.

- [#618](https://github.com/JollyPixel/editor/pull/618) [`8c634f1`](https://github.com/JollyPixel/editor/commit/8c634f1add3ec76e3a63d62bf6ae5bbd97e91a63) Thanks [@fraxken](https://github.com/fraxken)! - Reading a `.pixelart` document no longer pulls in `@jolly-pixel/asset-server`: the codec ships from the package root.

- [#564](https://github.com/JollyPixel/editor/pull/564) [`1541725`](https://github.com/JollyPixel/editor/commit/1541725c977cc4b74cf05045c2674585150a1383) Thanks [@fraxken](https://github.com/fraxken)! - `decodePng`, `InvalidPngError`, `DecodedPng` and `decodeRasterCanvas` move to `@jolly-pixel/image`. `encodeSelectionPng` output is now byte-exact.

- [#623](https://github.com/JollyPixel/editor/pull/623) [`02b3b44`](https://github.com/JollyPixel/editor/commit/02b3b44814abf14c24bfea237afababa6ff8b09c) Thanks [@fraxken](https://github.com/fraxken)! - Messages are parsed with JSON Schema: extensions declare `protocols` instead of `events` and `getEventName`. Fixes rights filtering on broadcasts.

- [#519](https://github.com/JollyPixel/editor/pull/519) [`a0f07ca`](https://github.com/JollyPixel/editor/commit/a0f07ca1f5d8ba66dd4819688602b51942036c1b) Thanks [@fraxken](https://github.com/fraxken)! - Add `@jolly-pixel/color`: a dependency-free CSS color parser, converter, formatter and
  deterministic palette, replacing `colorjs.io` and the duplicated color helpers across the editors.

- [#578](https://github.com/JollyPixel/editor/pull/578) [`7ed65f3`](https://github.com/JollyPixel/editor/commit/7ed65f3b58bf7127b65965a1b3b88c8adada0c3c) Thanks [@fraxken](https://github.com/fraxken)! - Blocks are textured per shape slot instead of per face, so stairs expose every quad they render; `faceTextures` is keyed by slot.

- [#601](https://github.com/JollyPixel/editor/pull/601) [`7b3c9de`](https://github.com/JollyPixel/editor/commit/7b3c9dec8aa72719a9e5f5df601cfd693fcaff26) Thanks [@fraxken](https://github.com/fraxken)! - Add an `unfolded` UV region state that packs the faces into a net; `collapsed` becomes `stacked` and `uncollapsed` becomes `free`, and `UVMap.setState()` replaces `collapse()`/`uncollapse()`. Old documents no longer load.

### Minor Changes

- [#526](https://github.com/JollyPixel/editor/pull/526) [`c2319ad`](https://github.com/JollyPixel/editor/commit/c2319adfeda24c36072c54a15ad8879b77d57645) Thanks [@fraxken](https://github.com/fraxken)! - Add `decodePng` and `createPixelArtBufferFromPng`, one PNG path for Node and browsers, and `resolveTilesetDefinition`.

- [#528](https://github.com/JollyPixel/editor/pull/528) [`d6f6a22`](https://github.com/JollyPixel/editor/commit/d6f6a22e8d9a5644b1e27622aa00d5e1af594702) Thanks [@fraxken](https://github.com/fraxken)! - Cut editor boot time by stopping the client from re-uploading its whole
  placeholder atlas on every load, resuming asset replay from the last snapshot
  checkpoint, and letting rooms resolve without blocking one another.

- [#575](https://github.com/JollyPixel/editor/pull/575) [`055990e`](https://github.com/JollyPixel/editor/commit/055990eb87908a5fc721a47b8d0b9ad456afabef) Thanks [@fraxken](https://github.com/fraxken)! - Selection overlay shows its size ("16×16") next to the outline, anchored
  below the bottom-right corner. Opt out with `select.sizeLabel: false`.
  `DefaultViewport` gains `canvasWidth` / `canvasHeight`.

- [#524](https://github.com/JollyPixel/editor/pull/524) [`7ec0367`](https://github.com/JollyPixel/editor/commit/7ec0367c989129c9081530a9aa69f6321be929fe) Thanks [@fraxken](https://github.com/fraxken)! - `CanvasBuffer` now emits `changed` with dirty bounds, plus `resized` and `replaced`. `PixelDocument` forwards them and is exposed as `PixelArtCanvas.document`, replacing `PixelDocument.onChange`/`offChange`.

- [#565](https://github.com/JollyPixel/editor/pull/565) [`a50002e`](https://github.com/JollyPixel/editor/commit/a50002e7ba24d1b529c21e9c966ccc86e8c9f977) Thanks [@fraxken](https://github.com/fraxken)! - UV faces follow the shape they belong to, so a pole or slab edits and renders only the part of its tile the geometry covers.

- [#599](https://github.com/JollyPixel/editor/pull/599) [`18c4ea9`](https://github.com/JollyPixel/editor/commit/18c4ea96c24b9dc85bf33cb86250d847c56ef7c8) Thanks [@fraxken](https://github.com/fraxken)! - Add an erase mode: the brush drawing `brush.erase` (transparent by default,
  overridable with the new `brush.eraseColor` option) with the same size, line
  and mouse-button behavior as painting.

- [#482](https://github.com/JollyPixel/editor/pull/482) [`8444ce6`](https://github.com/JollyPixel/editor/commit/8444ce69ba3162983f8eac4349f536371c036029) Thanks [@fraxken](https://github.com/fraxken)! - Refactor internal APIs and Types

- [#579](https://github.com/JollyPixel/editor/pull/579) [`72fb83a`](https://github.com/JollyPixel/editor/commit/72fb83abb6ff6a568b552e4baa85d5ce1755f21c) Thanks [@fraxken](https://github.com/fraxken)! - Add `uv.deselectOnEmptyClick` to control whether clicking outside every UV region clears the selection.

### Patch Changes

- [#521](https://github.com/JollyPixel/editor/pull/521) [`02bc332`](https://github.com/JollyPixel/editor/commit/02bc3329e46bf536727ad696140dc7d09ccccb92) Thanks [@fraxken](https://github.com/fraxken)! - Refactor voxel-map editor to use @jolly-pixel/ui components (+ diverses bug fixes)

- [#612](https://github.com/JollyPixel/editor/pull/612) [`6b09dd6`](https://github.com/JollyPixel/editor/commit/6b09dd6faa48f8d8600cf4a8e8a3b9126b24afb9) Thanks [@fraxken](https://github.com/fraxken)! - `isAssetEvent` becomes `parseAssetEvent`, which returns a `Result` telling a foreign event from a malformed one.

- [#628](https://github.com/JollyPixel/editor/pull/628) [`423db10`](https://github.com/JollyPixel/editor/commit/423db105df46e6ec7bb692beec0a37b1f9332fad) Thanks [@fraxken](https://github.com/fraxken)! - The extension hooks `onClientConnect`, `onClientDisconnect` and `onMessage` are optional; implementations need the `override` modifier.

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

- [#358](https://github.com/JollyPixel/editor/pull/358) [`dbf64ee`](https://github.com/JollyPixel/editor/commit/dbf64eee82e367ddf67bc9f01186df5ab2cb4f43) Thanks [@fraxken](https://github.com/fraxken)! - Add multiplayer cursors: `PixelArtCanvas` reports the local cursor and shows peers' through `peerCursors`, synced by `PixelCursorSession`.

- [#457](https://github.com/JollyPixel/editor/pull/457) [`250ea2b`](https://github.com/JollyPixel/editor/commit/250ea2b7742457ac280872ed9538a78a747a3d96) Thanks [@fraxken](https://github.com/fraxken)! - Enhance performance on buffer hot path

- [#369](https://github.com/JollyPixel/editor/pull/369) [`6f6594d`](https://github.com/JollyPixel/editor/commit/6f6594d9bea483ce53f61f3c92112c727d12bb7f) Thanks [@fraxken](https://github.com/fraxken)! - Implement minimal RBAC

- [#347](https://github.com/JollyPixel/editor/pull/347) [`b568905`](https://github.com/JollyPixel/editor/commit/b56890527e918a637d41a17a7b41f1077268d04d) Thanks [@fraxken](https://github.com/fraxken)! - Improve network client API surface (reducing boilerplate required to setup a new client/connection).

- [#370](https://github.com/JollyPixel/editor/pull/370) [`36c570c`](https://github.com/JollyPixel/editor/commit/36c570cf5bef538b7c59bb64b987b86f07cc91b9) Thanks [@fraxken](https://github.com/fraxken)! - Implement a minimalist Event Store workspace

- [#364](https://github.com/JollyPixel/editor/pull/364) [`cd003c3`](https://github.com/JollyPixel/editor/commit/cd003c39463f09a0735d9a58a9ac7eea0217399d) Thanks [@fraxken](https://github.com/fraxken)! - Make the network implementation easier for workspaces

- [#418](https://github.com/JollyPixel/editor/pull/418) [`f077f50`](https://github.com/JollyPixel/editor/commit/f077f50ca679d3198e96e735b8dda1bfbf074fa5) Thanks [@fraxken](https://github.com/fraxken)! - Add `hasTransparency(rect)` to `CanvasBuffer`/`PixelBuffer`, reporting whether any pixel in a rect isn't fully opaque. Out-of-bounds cells count as transparent, matching `samplePixel(s)`'s existing convention.

- [#460](https://github.com/JollyPixel/editor/pull/460) [`142794b`](https://github.com/JollyPixel/editor/commit/142794bc2085bcf48da48a8f1fa5f1c2373b6c7f) Thanks [@fraxken](https://github.com/fraxken)! - Floating selection clipboard workflow- [#460](https://github.com/jollypixel/editor/issues/460)

- [#344](https://github.com/JollyPixel/editor/pull/344) [`b660781`](https://github.com/JollyPixel/editor/commit/b6607812584c20351ea06bc46f773b1792a08360) Thanks [@fraxken](https://github.com/fraxken)! - Better trackpad navigation: drag to pan in `"move"` mode, `Space`+drag pans from any mode, and pinch and wheel zoom are smooth.

- [#419](https://github.com/JollyPixel/editor/pull/419) [`4bb203a`](https://github.com/JollyPixel/editor/commit/4bb203ac3c7c04a2a26c6610fa062b033ceae34a) Thanks [@fraxken](https://github.com/fraxken)! - Expose `hasTransparency(rect)` on `PixelArtCanvas`, delegating to the underlying buffer, so consumers can check for transparency without reaching into private internals.

- [#361](https://github.com/JollyPixel/editor/pull/361) [`34c1d7b`](https://github.com/JollyPixel/editor/commit/34c1d7b85bdf25f89988160cfdee1edeb4f7cf2f) Thanks [@fraxken](https://github.com/fraxken)! - Re-implement the network stack

- [#359](https://github.com/JollyPixel/editor/pull/359) [`4aa7e28`](https://github.com/JollyPixel/editor/commit/4aa7e28af054ceec2656c29966c8ab6259c74007) Thanks [@fraxken](https://github.com/fraxken)! - The Lit UI ships as `@jolly-pixel/pixel-draw.renderer/ui`, with `<pixel-draw-panel>` as a reusable component.

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

- [#321](https://github.com/JollyPixel/editor/pull/321) [`a9fe312`](https://github.com/JollyPixel/editor/commit/a9fe312098ec746454616ebc19b107511f213f02) Thanks [@fraxken](https://github.com/fraxken)! - `PixelArtCanvas` uses native accessors instead of `get`/`set` methods (`getMode()`/`setMode()` become `mode`, and so on); `getCanvas()` becomes `canvas()`.

- [#327](https://github.com/JollyPixel/editor/pull/327) [`6503dcc`](https://github.com/JollyPixel/editor/commit/6503dcc26cd83d66ba51491523b79260eb7145e0) Thanks [@fraxken](https://github.com/fraxken)! - Add `pickColorArmed` and `pickColorAt()` to pick a colour from the canvas. Right-click no longer picks a colour.

- [#331](https://github.com/JollyPixel/editor/pull/331) [`05346e9`](https://github.com/JollyPixel/editor/commit/05346e948b2dab70242834f3cb08499cf2173711) Thanks [@fraxken](https://github.com/fraxken)! - `PixelArtCanvas.keybindings` returns a `Keybindings` object; use `canvas.keybindings.patch()` instead of `patchKeybindings()`. The record type is renamed `KeybindingsMap`.

- [#321](https://github.com/JollyPixel/editor/pull/321) [`a9fe312`](https://github.com/JollyPixel/editor/commit/a9fe312098ec746454616ebc19b107511f213f02) Thanks [@fraxken](https://github.com/fraxken)! - Rename `CanvasManager` to `PixelArtCanvas` and `CanvasManagerOptions` to `PixelArtCanvasOptions`.

- [#328](https://github.com/JollyPixel/editor/pull/328) [`07f689f`](https://github.com/JollyPixel/editor/commit/07f689f767f30b904606f3365a274f49c248db7c) Thanks [@fraxken](https://github.com/fraxken)! - Left-click paints with `brush.primary` and right-click with `brush.secondary`; `Brush.color()` and `opacity` are replaced by `Brush.primary` and `Brush.secondary`.

- [#330](https://github.com/JollyPixel/editor/pull/330) [`f409a83`](https://github.com/JollyPixel/editor/commit/f409a834ddb1f0ef59f5db62e7864dfad83a33eb) Thanks [@fraxken](https://github.com/fraxken)! - `PixelArtCanvas.zoom` returns a `Zoom` object; use `zoom.value` and `zoom.sensitivity` instead of the number and `zoomSensitivity`.

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

- [#307](https://github.com/JollyPixel/editor/pull/307) [`7c2a32d`](https://github.com/JollyPixel/editor/commit/7c2a32d2333f8ab55141ada503d6a4851720b9c7) Thanks [@fraxken](https://github.com/fraxken)! - Add a paint-bucket `"fill"` mode. `PixelArtCanvas.commitLine` is renamed `commitPixels`.

- [#328](https://github.com/JollyPixel/editor/pull/328) [`07f689f`](https://github.com/JollyPixel/editor/commit/07f689f767f30b904606f3365a274f49c248db7c) Thanks [@fraxken](https://github.com/fraxken)! - Right-click in `"fill"` mode fills with `brush.secondary`.

- [#304](https://github.com/JollyPixel/editor/pull/304) [`2e01373`](https://github.com/JollyPixel/editor/commit/2e01373276c38c02759229ece5a14a98157f2849) Thanks [@fraxken](https://github.com/fraxken)! - Add Shift-to-line drawing tool in paint mode: holding Shift previews a brush-stamped, rasterized straight line via the SVG overlay, committed as a single history entry on mousedown/mouseup.

- [#332](https://github.com/JollyPixel/editor/pull/332) [`b6874d9`](https://github.com/JollyPixel/editor/commit/b6874d9d5c682d1aa038e4eae54b0905eea8a2fc) Thanks [@fraxken](https://github.com/fraxken)! - Moving, deleting or rotating a selection fills the vacated area with the surrounding colour instead of leaving a transparent hole.

- [#257](https://github.com/JollyPixel/editor/pull/257) [`5d78456`](https://github.com/JollyPixel/editor/commit/5d784561fbcd06c13a8c47259b2a09745e40bfdf) Thanks [@fraxken](https://github.com/fraxken)! - Implement new methods to destroy, better viewport resize and texture update

- [#320](https://github.com/JollyPixel/editor/pull/320) [`1675e4f`](https://github.com/JollyPixel/editor/commit/1675e4fb7f5f3bc19d1a37ae241b2f8be10d919a) Thanks [@fraxken](https://github.com/fraxken)! - Fill mode shows the brush cursor and supports colour picking, and `fillGlobal` recolours every pixel of the seed's colour across the canvas.

- [#317](https://github.com/JollyPixel/editor/pull/317) [`20818e2`](https://github.com/JollyPixel/editor/commit/20818e22a0767b7d7da04197747bde559b77ead5) Thanks [@fraxken](https://github.com/fraxken)! - Copy, paste, undo, redo and delete shortcuts are configurable, and match physical keys so they work on any keyboard layout.

- [#324](https://github.com/JollyPixel/editor/pull/324) [`e8c933f`](https://github.com/JollyPixel/editor/commit/e8c933f625dd17428a773c4d566631cbcd06d179) Thanks [@fraxken](https://github.com/fraxken)! - Add a `backgroundColor` option/property to `PixelArtCanvas`, letting callers set the canvas void color explicitly instead of relying solely on the parent element's inferred CSS `background-color`

- [#333](https://github.com/JollyPixel/editor/pull/333) [`6ce636d`](https://github.com/JollyPixel/editor/commit/6ce636d7903f699c10bfbf9240be69e837d690b1) Thanks [@fraxken](https://github.com/fraxken)! - Add a `"uv"` mode to `PixelArtCanvas` for placing, moving and deleting UV regions on a texture through `PixelArtCanvas.uv`, with undo/redo and network sync.

### Patch Changes

- [#326](https://github.com/JollyPixel/editor/pull/326) [`e62b62c`](https://github.com/JollyPixel/editor/commit/e62b62c15e04a2762ef780242b3e6924b8c2818f) Thanks [@fraxken](https://github.com/fraxken)! - Default `select.eraseColor` to fully transparent instead of opaque white, matching the erase/delete behavior of most pixel-art editors.

- [#333](https://github.com/JollyPixel/editor/pull/333) [`6ce636d`](https://github.com/JollyPixel/editor/commit/6ce636d7903f699c10bfbf9240be69e837d690b1) Thanks [@fraxken](https://github.com/fraxken)! - The default zoom fits the whole texture in its container instead of a flat `4`.

- [#333](https://github.com/JollyPixel/editor/pull/333) [`6ce636d`](https://github.com/JollyPixel/editor/commit/6ce636d7903f699c10bfbf9240be69e837d690b1) Thanks [@fraxken](https://github.com/fraxken)! - `"select"` mode shows a grab cursor over a selection that can be dragged.

- [#323](https://github.com/JollyPixel/editor/pull/323) [`61f9547`](https://github.com/JollyPixel/editor/commit/61f9547c9bd3fc1eb183b7b903ce2f0bd4af4ba0) Thanks [@fraxken](https://github.com/fraxken)! - Select tool: a plain click (no drag) no longer creates a degenerate 1x1 selection — the drag must grow past its starting pixel to commit.

- [#308](https://github.com/JollyPixel/editor/pull/308) [`96cf210`](https://github.com/JollyPixel/editor/commit/96cf2103a6d89a550a46aed9f57a4c46414e3c6d) Thanks [@fraxken](https://github.com/fraxken)! - Fixing backgroundColor in PixelArtCanvas when zooming In/Out

- [#333](https://github.com/JollyPixel/editor/pull/333) [`6ce636d`](https://github.com/JollyPixel/editor/commit/6ce636d7903f699c10bfbf9240be69e837d690b1) Thanks [@fraxken](https://github.com/fraxken)! - Fix undo/redo reactivating the selection overlay after leaving select mode: a select-edit history entry now only resyncs the selection (and its SVG overlay) when select mode is currently active, while pixels still restore regardless of mode.
