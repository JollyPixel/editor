# @jolly-pixel/ui

## 2.0.0

### Major Changes

- [#519](https://github.com/JollyPixel/editor/pull/519) [`a0f07ca`](https://github.com/JollyPixel/editor/commit/a0f07ca1f5d8ba66dd4819688602b51942036c1b) Thanks [@fraxken](https://github.com/fraxken)! - Add `@jolly-pixel/color`: a dependency-free CSS color parser, converter, formatter and
  deterministic palette, replacing `colorjs.io` and the duplicated color helpers across the editors.

- [#520](https://github.com/JollyPixel/editor/pull/520) [`a9a6ca8`](https://github.com/JollyPixel/editor/commit/a9a6ca8279097ff6e64a800f797a96ab21597e1b) Thanks [@fraxken](https://github.com/fraxken)! - Add presence and locking: a `PresenceSource` port, a `path` property claiming a field lock on focus, and `RoomPresenceSource` under the new `./network` subpath.

### Minor Changes

- [#521](https://github.com/JollyPixel/editor/pull/521) [`02bc332`](https://github.com/JollyPixel/editor/commit/02bc3329e46bf536727ad696140dc7d09ccccb92) Thanks [@fraxken](https://github.com/fraxken)! - Refactor voxel-map editor to use @jolly-pixel/ui components (+ diverses bug fixes)

- [#516](https://github.com/JollyPixel/editor/pull/516) [`66ee3e0`](https://github.com/JollyPixel/editor/commit/66ee3e0740bcf6ec96a507ad47c9d565a9750a48) Thanks [@fraxken](https://github.com/fraxken)! - Implement a new loop engine/workspace

- [#591](https://github.com/JollyPixel/editor/pull/591) [`014dbb0`](https://github.com/JollyPixel/editor/commit/014dbb0f4d5be9e3df8caefbbab47365f8a7fbf5) Thanks [@fraxken](https://github.com/fraxken)! - `jolly-folder` reads its content inset from `--jolly-folder-indent`, drops it
  under `flush`, stops collapsing when `collapsible` is false, and inverts a
  slotted `danger` action from the new `--jolly-folder-action-danger-*` tokens.
  Field rows read their trailing inset from `--jolly-field-inset-end`, so a
  subtree can land its values on the edge a header bar paints to. The voxel-map
  Layers tab uses both, with its folder actions moved into the header as icons.

- [#502](https://github.com/JollyPixel/editor/pull/502) [`db58ed4`](https://github.com/JollyPixel/editor/commit/db58ed4f87cd137eb7e3a0470e75febcbad5034b) Thanks [@fraxken](https://github.com/fraxken)! - Migrate pixel-art editors to use @jolly-pixel/ui

- [#570](https://github.com/JollyPixel/editor/pull/570) [`72b75c0`](https://github.com/JollyPixel/editor/commit/72b75c0e550e1dc261d9f86a6864b29e91cc3b8e) Thanks [@fraxken](https://github.com/fraxken)! - `jolly-vector2` takes an `axes` pair, `"xy"`, `"xz"` or `"yz"`, and carries the
  chosen key through its value, glyph and axis colour.

- [#597](https://github.com/JollyPixel/editor/pull/597) [`cf4816d`](https://github.com/JollyPixel/editor/commit/cf4816dc112090f4b0e90d9c417e4817a8b2f956) Thanks [@fraxken](https://github.com/fraxken)! - Enter now activates a `jolly-dialog` default action: the `actions` element
  marked `data-default`, otherwise the last accent or danger one. `showConfirm()`
  opens with its confirm action focused, and `jolly-button` delegates focus.

- [#539](https://github.com/JollyPixel/editor/pull/539) [`3bde59b`](https://github.com/JollyPixel/editor/commit/3bde59b0a25d61653b3200849c64bf93c3d30c8d) Thanks [@fraxken](https://github.com/fraxken)! - Add opt-in inline renaming to `jolly-tree`: double-click or F2 edits a row
  label in place and emits `jolly-rename`.

- [#487](https://github.com/JollyPixel/editor/pull/487) [`71953e5`](https://github.com/JollyPixel/editor/commit/71953e5e7d63eddb44702d8ab8897536e27b363f) Thanks [@fraxken](https://github.com/fraxken)! - Add the DOM-free `StatsRecorder` API and the themeable, cycling `jolly-stats` performance HUD. Replace stats.js with the JollyPixel recorder and HUD, with optional mounting and top-corner placement.

- [#622](https://github.com/JollyPixel/editor/pull/622) [`2391a21`](https://github.com/JollyPixel/editor/commit/2391a213543812f357d99f25d3a7ba58e33a57f2) Thanks [@fraxken](https://github.com/fraxken)! - Add `jolly-log`, a capped feed of short status messages, with a DOM-free `LogQueue` owning the cap and the per-entry grace period.
  Wire it into the voxel-map viewport for peer joins, peer departures and camera mode changes.

- [#494](https://github.com/JollyPixel/editor/pull/494) [`9b87bfe`](https://github.com/JollyPixel/editor/commit/9b87bfe6de642aaf3ea9d25a09dd3b022bb8f8dc) Thanks [@fraxken](https://github.com/fraxken)! - Add math components (Vector2, Vector3, Vector4, Quaternion, Point2D etc)

- [#562](https://github.com/JollyPixel/editor/pull/562) [`19e1012`](https://github.com/JollyPixel/editor/commit/19e1012fa8b3260b38212a462a62addba8f1b5de) Thanks [@fraxken](https://github.com/fraxken)! - `addBinding` now dispatches vector, quaternion and point2d fields from a value's
  own axes, writing back component-wise so a bound `THREE.Vector3` keeps its
  identity. Adds `Pane` `labelWidth`, color `alpha`, vector monitors and
  `onFieldChange`.

- [#561](https://github.com/JollyPixel/editor/pull/561) [`8cce611`](https://github.com/JollyPixel/editor/commit/8cce611bbaa0b9e393834fc373b8aac81ae7f04f) Thanks [@fraxken](https://github.com/fraxken)! - `jolly-floating` persists `hidden` with its geometry, and `Pane` takes a
  `storageKey` option pinning the namespace it persists under. The voxel-map
  performance HUD uses both, so `F3` and its fold survive a reload.

- [#477](https://github.com/JollyPixel/editor/pull/477) [`cd04886`](https://github.com/JollyPixel/editor/commit/cd048869b91af6a09ff56c73b8701b47fc13d78e) Thanks [@fraxken](https://github.com/fraxken)! - Add `CornerResizeHandle` for resizing both axes at once from a single pointer drag.

- [#595](https://github.com/JollyPixel/editor/pull/595) [`245bc85`](https://github.com/JollyPixel/editor/commit/245bc850a6f0798459b2e829ad99add3e0510c54) Thanks [@fraxken](https://github.com/fraxken)! - Clicking a collaborator in the voxel-map presence panel teleports the camera to
  their position and orientation, through a `selectable` opt-in on
  `jolly-presence` and `PeerFrustumSync.poseOf()`. Peer frustums now fade out up
  close, and the color swatch loses its border.

- [#591](https://github.com/JollyPixel/editor/pull/591) [`eec5e52`](https://github.com/JollyPixel/editor/commit/eec5e52f462e33212e05f474e9ed44aee5a33a82) Thanks [@fraxken](https://github.com/fraxken)! - `jolly-tree` takes an `acceptDrop` domain veto, consulted while dragging and on
  commit. `VoxelWorld.moveLayerTo()` moves a layer to an absolute index and emits
  a `layer-moved` command. The voxel-map layer tree is reordered by drag instead
  of the arrow buttons, which are gone.

- [#629](https://github.com/JollyPixel/editor/pull/629) [`444fba8`](https://github.com/JollyPixel/editor/commit/444fba8abd23c4407f84e3110c53fec1f3710496) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - `jolly-tree` drops past the last (or before the first) row now read horizontal
  position as depth, promoting the dragged node up its ancestor chain or
  straight to root. Drop indicators start at the target row's own indent
  instead of spanning the blank gutter to its left, and no longer linger after
  a drop. The tree also adds an `indentGuides` option, stops showing the expand
  arrow on a childless branch, and keeps its arrow and node icons flush and
  equal in size.

- [#614](https://github.com/JollyPixel/editor/pull/614) [`ac50655`](https://github.com/JollyPixel/editor/commit/ac50655063011ff4f1ec7bddd78a95ef77fd6f56) Thanks [@fraxken](https://github.com/fraxken)! - Add `TreeNode.badges`, a list of `{ color, title }` dots `jolly-tree` renders
  after a row label. The tree resolves neither field and emits nothing for a dot,
  so a consumer decides what one stands for (ADR-0030).

- [#486](https://github.com/JollyPixel/editor/pull/486) [`d89455e`](https://github.com/JollyPixel/editor/commit/d89455e2093dd644ee67debadd0d7177857a6a59) Thanks [@fraxken](https://github.com/fraxken)! - Implement <jolly-progress> and <jolly-loading> inside UI and use them in runtime

- [#585](https://github.com/JollyPixel/editor/pull/585) [`578fded`](https://github.com/JollyPixel/editor/commit/578fded23cd3e7a81b9a80d20f9571244398e633) Thanks [@fraxken](https://github.com/fraxken)! - `jolly-folder` gains an `actions` slot that puts buttons in its header, next to
  the grip, and a `plus` builtin glyph. The voxel-map block library moves its add
  and edit buttons there, dropping the toolbar row that sat above the grid.
  
  Fields gain a `--jolly-label-max-width` property over the fixed 45% label cap,
  and an unlabeled `jolly-button-group` falls back to its `aria-label`. The block
  library uses both to fit rotation and Flip Y on one row.

### Patch Changes

- [#537](https://github.com/JollyPixel/editor/pull/537) [`d9e0b8a`](https://github.com/JollyPixel/editor/commit/d9e0b8aa2edec5a0dc77f16d676e7daeb93be117) Thanks [@fraxken](https://github.com/fraxken)! - Export Vec2Like interface

- [#535](https://github.com/JollyPixel/editor/pull/535) [`939ac02`](https://github.com/JollyPixel/editor/commit/939ac022b35ae9cf5e0e1d3210731cee8fcbc32d) Thanks [@fraxken](https://github.com/fraxken)! - Drop the leading inset a field kept for a label it does not render. A field with
  an empty label now reflects `unlabeled` and gives its value the whole row, inset
  evenly on both edges.

- [#483](https://github.com/JollyPixel/editor/pull/483) [`b4a7046`](https://github.com/JollyPixel/editor/commit/b4a704691b17dfec6cafc637c757c937913632b4) Thanks [@fraxken](https://github.com/fraxken)! - Fix `jolly-floating` painting under static content before its first interaction, and `jolly-theme-preferences` reporting zero height to `Pane.occupiedSize()`, which threw off dock drop indicators.

- [#587](https://github.com/JollyPixel/editor/pull/587) [`4618512`](https://github.com/JollyPixel/editor/commit/46185125cdefbcc0dd821c82612afc13e2696aec) Thanks [@fraxken](https://github.com/fraxken)! - Add a `formatDecimal(value, decimals?)` monitor formatter, defaulting to one
  decimal. `formatMilliseconds` and `formatPercent` now build on it.

- [#568](https://github.com/JollyPixel/editor/pull/568) [`33cba8e`](https://github.com/JollyPixel/editor/commit/33cba8e750bdd4cac96f409c3cf310159f73ad20) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - Added a selection subsystem for `THREE.Scene` objects: `SelectionManager` drives
  per-object outlining (`SelectionOutline`, `SelectionBoundingBox` with optional
  fill, `MergedSelectionOverlay` for bulk/instanced selections) and scene-level
  postprocess techniques (`HighlightPass`, a JFA-based `HighlightPassJfa`), all
  supporting `THREE.InstancedMesh` via `instanceId`. Techniques are open for
  registration through `SelectionOverlayRegistry`.
  
  Added network presence for selection and hover: `PeerSelectionRegistry`,
  `PeerHoverRegistry`, and their overlay/postprocess renderers
  (`PeerSelectionOverlays`, `PeerHighlightPass`, `PeerHoverOverlays`) show what
  every connected peer is selecting and hovering, with `PeerSelectionChips` for
  overlapping selectors and `PeerSelectionVisibility` for frustum/distance
  gating. `PeerSelectionSync`/`PeerHoverSync` (`@jolly-pixel/three/network`)
  publish and apply this state over a `@jolly-pixel/network` room's presence.
  
  Fixed `@jolly-pixel/ui`'s `PropertyRow` `hidden` attribute doing nothing.

- [#483](https://github.com/JollyPixel/editor/pull/483) [`b4a7046`](https://github.com/JollyPixel/editor/commit/b4a704691b17dfec6cafc637c757c937913632b4) Thanks [@fraxken](https://github.com/fraxken)! - Fix `jolly-floating` not actually collapsing when the pane it holds folds — the window now shrinks to the pane's header instead of leaving empty space, and its height handles disable while folded.

- [#609](https://github.com/JollyPixel/editor/pull/609) [`bf18d36`](https://github.com/JollyPixel/editor/commit/bf18d36840b7be32ca239b865c7a21dab0510afb) Thanks [@fraxken](https://github.com/fraxken)! - Resolve the selected tab in `willUpdate` instead of `updated`, so a `value`
  assigned before the tabs are slotted survives the first render and Lit no
  longer warns about an update scheduled after an update completed.
- Updated dependencies [[`d6f6a22`](https://github.com/JollyPixel/editor/commit/d6f6a22e8d9a5644b1e27622aa00d5e1af594702), [`c9fa209`](https://github.com/JollyPixel/editor/commit/c9fa2090fc08b3151f107290459dbd050a584186), [`423db10`](https://github.com/JollyPixel/editor/commit/423db105df46e6ec7bb692beec0a37b1f9332fad), [`02b3b44`](https://github.com/JollyPixel/editor/commit/02b3b44814abf14c24bfea237afababa6ff8b09c), [`cd04886`](https://github.com/JollyPixel/editor/commit/cd048869b91af6a09ff56c73b8701b47fc13d78e), [`a9a6ca8`](https://github.com/JollyPixel/editor/commit/a9a6ca8279097ff6e64a800f797a96ab21597e1b)]:
  - @jolly-pixel/network@2.0.0
  - @jolly-pixel/resize-handle@1.2.0

## 1.0.1

### Patch Changes

- Updated dependencies [[`0d4d6e5`](https://github.com/JollyPixel/editor/commit/0d4d6e55d71d8416a160d067df9f4613a54ad263)]:
  - @jolly-pixel/resize-handle@1.1.0
