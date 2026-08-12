# @jolly-pixel/pixel-draw.renderer

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
