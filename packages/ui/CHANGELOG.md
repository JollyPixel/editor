# @jolly-pixel/ui

## 4.0.0

### Major Changes

- [#895](https://github.com/JollyPixel/editor/pull/895) [`912d0f7`](https://github.com/JollyPixel/editor/commit/912d0f702ab8697c5a501df6289674e97c498059) Thanks [@fraxken](https://github.com/fraxken)! - A field's revert button now sits at the end of its label column, so modified rows keep their neighbours' value column; `--jolly-field-trailing-width` is removed.
  Fields, `jolly-property-row` and `jolly-transform` gain `labelPosition: "auto"` with `stackBelow` (also `Pane` options for every row) and `descriptionDisplay: "tooltip"`; `PopoverController` takes `claimsInput`.

- [#930](https://github.com/JollyPixel/editor/pull/930) [`66697bd`](https://github.com/JollyPixel/editor/commit/66697bd469e84f261a4b1a018720b92d33befd04) Thanks [@fraxken](https://github.com/fraxken)! - `LogQueue` drops the `now` and `schedule` options and the `LogScheduler` type: expiry always runs on `setTimeout` and `Date.now()`, which tests drive with `mock.timers`.

### Minor Changes

- [#945](https://github.com/JollyPixel/editor/pull/945) [`c0643f9`](https://github.com/JollyPixel/editor/commit/c0643f9978941d93eb2fee7ca4d524fc20e23339) Thanks [@fraxken](https://github.com/fraxken)! - Accounts have an owner: the first account, which no admin can demote or remove, and which hands ownership to another account with `AccountsRoster.transferOwnership`. `Account.owner` flags it, and the last-admin rule is gone.
  `AccountsDatabase` replaces `AccountStore`: `new Accounts()` takes `{ database, roles }`, and `StoredAccount` is no longer exported.
  `TreeBadge.icon` draws a badge as an icon in its colour instead of a dot.

- [#874](https://github.com/JollyPixel/editor/pull/874) [`5d51844`](https://github.com/JollyPixel/editor/commit/5d51844c63797adadd53070d1080e1c151cf343e) Thanks [@fraxken](https://github.com/fraxken)! - `jolly-context-menu` items accept `items` to open a nested submenu, placed on the right or the left of its item depending on room.
  Submenus open on hover, click, Right Arrow, Enter or Space, and close with Left Arrow or Escape.
  `PopoverControllerOptions` gains `onReposition`, called after each placement of the open popover.

- [#867](https://github.com/JollyPixel/editor/pull/867) [`f03cb7a`](https://github.com/JollyPixel/editor/commit/f03cb7a89b574ba6965f3b88d0ad5796de6cbdce) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - Open asset rooms broadcast a fresh snapshot when their content is replaced from outside (`AssetStateStore` emits `replaced`), and `peerPresence.uvSelections` outlines each peer's selected UV region below the local selection.
  Truncated `@jolly-pixel/ui` labels show their full text on hover (`overflow-title="off"` disables it), `jolly-pane-group` tabs collapse to their icon when the strip is too narrow, and `jolly-tree` takes `swatch-position="start"`.

- [#939](https://github.com/JollyPixel/editor/pull/939) [`a23ea74`](https://github.com/JollyPixel/editor/commit/a23ea74dca38f8684e890f0abed659277ccc230e) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - `CommandHistory` loses its `scopes` option: a scope starts with its first step and `removeScope()` drops it; `EMPTY_HISTORY_STATE` is exported and `HistoryScopeState.refused` is now readonly.
  `@jolly-pixel/ui/network` exports `presencePeerOf(peer)`, plus `markedPeers()` and `peerMarks()` to build a `PeerMarkMap` from presence values that carry more than a key.

- [#888](https://github.com/JollyPixel/editor/pull/888) [`9ed0ad8`](https://github.com/JollyPixel/editor/commit/9ed0ad82e1bc15518d64314cf1859dee71c1bb5d) Thanks [@fraxken](https://github.com/fraxken)! - Add opt-in hover opening and closing with configurable delays to PopoverController.
  Allow placement side callbacks for triggers that move between toolbars.

- [#922](https://github.com/JollyPixel/editor/pull/922) [`12dca6e`](https://github.com/JollyPixel/editor/commit/12dca6e98be8b71f9ef8517edcc17d8e8520fb72) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - Add `CommandHistory`: per-person undo and redo over `CommandDocument`s, synced by `DocumentSyncClient` and owned by `SyncedCommandDocument`, refusing a step a peer changed since.
  Resyncs carry `refused` and `CommandSync` emits `"refused"` on rollback; `ChangeReceipts` carries the server's answers about local changes.
  `jolly-tree` takes `validateRename` to refuse a rename, and `TreeNode.warning` flags a row with a warning icon.

- [#938](https://github.com/JollyPixel/editor/pull/938) [`3e9603a`](https://github.com/JollyPixel/editor/commit/3e9603ad94b7a4751a13e7232651a584b93a75e2) Thanks [@fraxken](https://github.com/fraxken)! - Add `jolly-layer-grid` (`LayerGrid`), a Godot-style grid of up to 32 numbered cells that edits a layer mask or, with `mode: "index"`, one index. Click toggles, drag paints.
  The facade builds it for a number with `view: "layers"`.

- [#929](https://github.com/JollyPixel/editor/pull/929) [`2f1c4ad`](https://github.com/JollyPixel/editor/commit/2f1c4ad18ecb8ce413d3951899c6096af666e9fb) Thanks [@fraxken](https://github.com/fraxken)! - Add `jolly-avatar` with nine default glyphs picked from the peer id, drawn in `jolly-presence` rows and through `TreeNode.avatar`.
  `peerIdentity` takes an optional `avatar` image path, and `PresencePeer` gains one, read from server-owned profiles with `readAvatar`.

- [#905](https://github.com/JollyPixel/editor/pull/905) [`26b8b55`](https://github.com/JollyPixel/editor/commit/26b8b551d00aa70ea11b7b7e0097f70c1da43dc3) Thanks [@fraxken](https://github.com/fraxken)! - `formatCount` takes an optional `singular` and `plural` unit (`formatCount(3, "voxel")` gives `"3 voxels"`).
  `@jolly-pixel/ui/network` exports `peerBadges(key, marks)`, which turns a `PeerMarkMap` bucket into up to three `jolly-tree` badges.
  Exports `SubscriptionController<TSource>`, a Lit controller that keeps a host subscribed to one attached source while connected.

- [#928](https://github.com/JollyPixel/editor/pull/928) [`d4b3ad1`](https://github.com/JollyPixel/editor/commit/d4b3ad1a7cab4677c23f671e391ae95b2dffe860) Thanks [@fraxken](https://github.com/fraxken)! - Add `peerIdentity(username, peerId?)`, which builds a `PeerIdentity` with the color derived from its peer id.

- [#854](https://github.com/JollyPixel/editor/pull/854) [`e780033`](https://github.com/JollyPixel/editor/commit/e7800335b131d45645d4a62459684993d8b87af8) Thanks [@fraxken](https://github.com/fraxken)! - Faster large trees, dock and floating drags, scrubbing, graphs, stats, facade refreshes and presence locks: fewer per-row lookups, allocations, DOM measurements and re-renders, with identical output.
  `jolly-tree` re-renders only the rows whose displayed content or state changed, gains a `virtual` mode backed by `@lit-labs/virtualizer`, moves focus with arrow-key selection and sets `aria-level`/`aria-posinset`/`aria-setsize`.
  `TreeSnapshot.placement(id)` returns a node's position among its siblings.

- [#937](https://github.com/JollyPixel/editor/pull/937) [`4647e7d`](https://github.com/JollyPixel/editor/commit/4647e7dc2eeb6a9c331677fdc06440c4e049f556) Thanks [@fraxken](https://github.com/fraxken)! - Add `jolly-spin-slider` (`SpinSlider`), a bounded number field with a thin range bar under the value: drag to scrub, click to type, press the bar to jump.
  The facade builds it for a bounded number with `view: "spin"`.

- [#859](https://github.com/JollyPixel/editor/pull/859) [`425cef9`](https://github.com/JollyPixel/editor/commit/425cef984d0c6e5bf06f99fa29e0282acb47350b) Thanks [@fraxken](https://github.com/fraxken)! - `TreeNode.collapsible: false` keeps a branch's children shown in `jolly-tree`, with no expand toggle.

- [#928](https://github.com/JollyPixel/editor/pull/928) [`c86b214`](https://github.com/JollyPixel/editor/commit/c86b214c710a64428fa251465f3bcd7984471a36) Thanks [@fraxken](https://github.com/fraxken)! - `jolly-tree` exposes each row swatch as the `swatch` part, so a page can space it from the label.

- [#895](https://github.com/JollyPixel/editor/pull/895) [`d3cc3ee`](https://github.com/JollyPixel/editor/commit/d3cc3ee8679f691f130274eadd074ca717e52346) Thanks [@fraxken](https://github.com/fraxken)! - Vector, quaternion and transform fields gain `axisStyle` (`"corner"`, `"chip"` or `"letter"`, also a `Defaults` entry and a binding option) to show the axis letter at the input's leading edge.
  Peer chips move from over the value's corner to the end of the label cell, and stacked rows put chips and revert at the label line's right.

### Patch Changes

- [#930](https://github.com/JollyPixel/editor/pull/930) [`86dbb95`](https://github.com/JollyPixel/editor/commit/86dbb95270aae8eb3cc89a76d518a51fe93faebf) Thanks [@fraxken](https://github.com/fraxken)! - A context menu submenu chevron now sits on the side its submenu opens on and points toward it; submenus turn left once the right side cannot hold a menu at its `max-width`.
  A submenu opened while its parent menu is still scaling in now lines up with its item instead of sitting a few pixels off.

- [#945](https://github.com/JollyPixel/editor/pull/945) [`ef2c7fe`](https://github.com/JollyPixel/editor/commit/ef2c7fe37e1d532b745e6462c26bb9f650ccc875) Thanks [@fraxken](https://github.com/fraxken)! - Profiles update live: `Server.updateProfile` (fed by `AuthenticationProvider.watchProfiles`) sends `peer-profile` to every room member, and `Room.profile` holds the profile the server admitted for this client.
  `Accounts.watchProfiles` reports a new avatar, and `PeerRoster` follows both, so peers and the local row show it without reconnecting.

- [#930](https://github.com/JollyPixel/editor/pull/930) [`a75ee6d`](https://github.com/JollyPixel/editor/commit/a75ee6dc5ef94c274f0f3b69d8eeff73e018e495) Thanks [@fraxken](https://github.com/fraxken)! - A pane dropped on a group's tab strip now stays the shown tab instead of falling back to the first one.
  Drag drop zones no longer fade in when reduced motion is requested.

- [#896](https://github.com/JollyPixel/editor/pull/896) [`e1808f6`](https://github.com/JollyPixel/editor/commit/e1808f6a02cf3569d5838a601dcc0946d8fbb164) Thanks [@fraxken](https://github.com/fraxken)! - `PopoverController`: a click on the trigger of a hover-opened popover keeps it open instead of closing it, and pins it against hover closing.

- [#957](https://github.com/JollyPixel/editor/pull/957) [`f724870`](https://github.com/JollyPixel/editor/commit/f72487033a8df5e7077e37780082c72f7c99688a) Thanks [@fraxken](https://github.com/fraxken)! - `jolly-spin-slider` uses its `label` as the accessible name of its spinbutton input.

- [#886](https://github.com/JollyPixel/editor/pull/886) [`5e9f29d`](https://github.com/JollyPixel/editor/commit/5e9f29d41de26d6bc738f36e8cb5f80b03a55e90) Thanks [@fraxken](https://github.com/fraxken)! - Fix dock tab labels staying hidden after widening a pane group.
  Measure expanded tabs so stretched tabs restore labels when space is sufficient.
- Updated dependencies [[`35f9459`](https://github.com/JollyPixel/editor/commit/35f94598ed00f46dfd07152c752f8604d6ce436f), [`09eabd6`](https://github.com/JollyPixel/editor/commit/09eabd676125ee69ac8e823815c62fd01b4feb5a), [`f174add`](https://github.com/JollyPixel/editor/commit/f174addea4b885bd601976b7fd730a91a0b047c4), [`ef2c7fe`](https://github.com/JollyPixel/editor/commit/ef2c7fe37e1d532b745e6462c26bb9f650ccc875), [`12dca6e`](https://github.com/JollyPixel/editor/commit/12dca6e98be8b71f9ef8517edcc17d8e8520fb72), [`02172bd`](https://github.com/JollyPixel/editor/commit/02172bd0a88a1db4612b76a41d78e424517f5ba0), [`c86b214`](https://github.com/JollyPixel/editor/commit/c86b214c710a64428fa251465f3bcd7984471a36), [`40e16a4`](https://github.com/JollyPixel/editor/commit/40e16a4ae92fdb94931b59e9ba80af52330b1bc4), [`27cff63`](https://github.com/JollyPixel/editor/commit/27cff63c507ae72b62c0299999590c839f2ac492), [`28dae7b`](https://github.com/JollyPixel/editor/commit/28dae7b8ef17f600128ba02cfe33436afadf1c92), [`5fbedf2`](https://github.com/JollyPixel/editor/commit/5fbedf27124e3deb38992f3b70592b9536d9223c), [`a75ee6d`](https://github.com/JollyPixel/editor/commit/a75ee6dc5ef94c274f0f3b69d8eeff73e018e495), [`e646731`](https://github.com/JollyPixel/editor/commit/e646731d6968af9a58604f5b503950e73dfa9681)]:
  - @jolly-pixel/network@6.0.0
  - @jolly-pixel/color@1.1.2

## 3.2.0

### Minor Changes

- [#834](https://github.com/JollyPixel/editor/pull/834) [`3795267`](https://github.com/JollyPixel/editor/commit/37952670b39501299cd97be272d1da1704f68c97) Thanks [@fraxken](https://github.com/fraxken)! - Add `AmbientThemeController`: `jolly-dialog` and `jolly-console` now follow page theme changes while open, including a switch to `auto`.

- [#837](https://github.com/JollyPixel/editor/pull/837) [`921c7a6`](https://github.com/JollyPixel/editor/commit/921c7a6ae7195ba5099b964416145865eff269e4) Thanks [@fraxken](https://github.com/fraxken)! - `ContextMenuItem` takes `intent: "danger"`, and `PopoverController.show()` places a popover before its first frame.
  Overlay popovers scale from their anchor; the context menu renders, places and focuses its items as `openAt` runs.

- [#838](https://github.com/JollyPixel/editor/pull/838) [`e1c4a2d`](https://github.com/JollyPixel/editor/commit/e1c4a2d163156a30dd89a432fd801eb23c4687c4) Thanks [@fraxken](https://github.com/fraxken)! - Add illustrated icons: `registerIcon(name, glyph, { viewBox })` draws a full-colour glyph on its own grid, read back with `iconViewBox()`, and `jolly-tree` gains `--jolly-tree-icon-size`.
  `AssetKindIcon` accepts `viewBox`.

- [#812](https://github.com/JollyPixel/editor/pull/812) [`f2182da`](https://github.com/JollyPixel/editor/commit/f2182da4d77756bf62bf2c12d4ca2a41fedd76ab) Thanks [@fraxken](https://github.com/fraxken)! - `jolly-separator` gains an `actions` slot: slotted elements trail the rule on the same row, outside the `separator` role.

- [#838](https://github.com/JollyPixel/editor/pull/838) [`e1c4a2d`](https://github.com/JollyPixel/editor/commit/e1c4a2d163156a30dd89a432fd801eb23c4687c4) Thanks [@fraxken](https://github.com/fraxken)! - Add `--jolly-tab-close-size` and `--jolly-tab-close-icon-size` to `jolly-tabs`, and centre a tab label's cap height on its icon.

- [#774](https://github.com/JollyPixel/editor/pull/774) [`a54b8a8`](https://github.com/JollyPixel/editor/commit/a54b8a8bdf5597293fcb1a960ed35aeb0a57d603) Thanks [@fraxken](https://github.com/fraxken)! - Add `reorderable` to `jolly-tabs` (`jolly-tab-reorder` event) and `icon`, `icon-only` and `fixed` to `jolly-tab`.
  A docked `jolly-dock` now keeps its resize handle inside its own edge, sized by `--jolly-dock-handle-size`, and a collapsed one stays visible as that handle.

- [#773](https://github.com/JollyPixel/editor/pull/773) [`6339aea`](https://github.com/JollyPixel/editor/commit/6339aea20bf9777054eec1e6cb828d40fe96c3cc) Thanks [@fraxken](https://github.com/fraxken)! - Add `activateOnDoubleClick` and `beginRename(id)` to `jolly-tree`, so a renamable tree can still open rows on double-click and rename from F2 or an action.

- [#821](https://github.com/JollyPixel/editor/pull/821) [`ad38d4e`](https://github.com/JollyPixel/editor/commit/ad38d4e8935e0a759c0d4f7add3771ab0543f9b0) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - Add `jolly-context-menu` (a point or `AnchorRect` anchor) and `resolveReparentMoves()`; `jolly-tree` emits `jolly-context-request` on right-click or Shift+F10, samples rows with `TreeNode.swatch` (`jolly-activate-swatch`) and exposes a `grip` part.
  Locked fields no longer reflow and peer chips skip their own user; pane `actions` buttons no longer start a drag, clicks in the rename field keep it open, and `jolly-dialog` accepts `--jolly-dialog-backdrop-filter`.
  `MeshHighlight` gains `emphasize(ids)`, `emphasized` and `emphasisChange`; `ObjectOverlayRenderer` takes an optional `renderScene`, without which `render` only places the overlays.

- [#785](https://github.com/JollyPixel/editor/pull/785) [`10f797b`](https://github.com/JollyPixel/editor/commit/10f797bb711798024f7ed82ed6c615e12de54e3d) Thanks [@fraxken](https://github.com/fraxken)! - Add `requireSelection` to `jolly-tree`: empty-area clicks and Ctrl+click on the last selected row no longer clear the selection.

- [#815](https://github.com/JollyPixel/editor/pull/815) [`b691bbf`](https://github.com/JollyPixel/editor/commit/b691bbf91d44d5d5fa65d32165e6d0688d82e06a) Thanks [@fraxken](https://github.com/fraxken)! - `inputLayers.push()` accepts `{ dismiss }` and `inputLayers.dismissAll()` closes every open layer, returning `false` when one refuses.
  `jolly-dialog` dismisses through its cancel path unless `dismissible` is `false`; `PopoverController` popovers dismiss by hiding.
  New `adoptAmbientTheme(element, adopted)` sets an element's `theme` attribute to its ambient theme unless the author set one.

- [#840](https://github.com/JollyPixel/editor/pull/840) [`1452db0`](https://github.com/JollyPixel/editor/commit/1452db0b72b073fbb4c5c46fd37dfe748da1e7f7) Thanks [@fraxken](https://github.com/fraxken)! - Export `THEME_MODES` and `DENSITIES`, the values of `ThemeMode` and `Density`.

- [#803](https://github.com/JollyPixel/editor/pull/803) [`ab4ad1a`](https://github.com/JollyPixel/editor/commit/ab4ad1a00b61463b39aaaae73644ca329898b8de) Thanks [@fraxken](https://github.com/fraxken)! - Remove `VoxelEngine`: `VoxelRenderer` exposes `document` and `view`, the codec helpers become `parseVoxelWorld`/`encodeVoxelWorld`/`decodeVoxelWorld`, the `apply*Command()` helpers become `apply()` on `BlockRegistry`, `MaterialGroupList` and `TilesetList` (returning the applied command or `null`), object layers move to `world.objectLayers`, `view.tilesets` becomes `view.atlases`, and the `invalidated` event, `registerTileset()` and `PartialExcept` are gone.
  Remove greedy meshing and `retainVertexData`: every chunk is vertex pulled at 8 bytes per face and can be meshed in Web Workers (`meshing.workers`, `runMeshWorker()`); view options are grouped into `rendering`, `lighting`, `range` and `meshing`, adding baked ambient occlusion, chunk shadows, `farDistance`, `alphaToCoverage` and box-filtered distant tiles.
  GPU memory is measurable through the voxel `meshMemory` and runtime `geometryMemory`/`textureMemory` metrics with a `bytes` unit in `@jolly-pixel/ui`; fix hidden layers reappearing, stale meshes after `cloneLayer()` and `view.dispose()` clearing the document's tilesets.

### Patch Changes

- [#812](https://github.com/JollyPixel/editor/pull/812) [`799d17c`](https://github.com/JollyPixel/editor/commit/799d17cd8d7732d84664b0109648fb353bd3ad0e) Thanks [@fraxken](https://github.com/fraxken)! - The `Pane` facade's `hidden` and `dispose()` now follow a floating pane into a dock, so a toggle key such as the metrics panel's keeps working once the pane is docked.

- [#837](https://github.com/JollyPixel/editor/pull/837) [`75d0d66`](https://github.com/JollyPixel/editor/commit/75d0d666a436bb8399fda93930da84c16b02f93a) Thanks [@fraxken](https://github.com/fraxken)! - `jolly-toolbar` row now fills its host, so slotted controls can grow to take the free width.
- Updated dependencies [[`399e1e4`](https://github.com/JollyPixel/editor/commit/399e1e448a7cab33990ccb000c381ec266060de5), [`e206538`](https://github.com/JollyPixel/editor/commit/e2065388190abbe17facabbbe64fac562fa628de), [`8d33c94`](https://github.com/JollyPixel/editor/commit/8d33c9415c21955b94f3c294ceb347f733534787), [`1bbae1c`](https://github.com/JollyPixel/editor/commit/1bbae1ceddffa7431cbe9c711d41a3c401a5dc93), [`5d415e4`](https://github.com/JollyPixel/editor/commit/5d415e4f680fd90ba0ec3819b018baa5c59382fe), [`4a6ffd0`](https://github.com/JollyPixel/editor/commit/4a6ffd0841535389f5c61246cbf8d5b45d9f408e), [`71d300a`](https://github.com/JollyPixel/editor/commit/71d300a76e87200b52cb4a1e9394ce22793c2a8a), [`b520e7e`](https://github.com/JollyPixel/editor/commit/b520e7e37c000763a492f68635af528ca461a285)]:
  - @jolly-pixel/network@5.0.0
  - @jolly-pixel/color@1.1.1
  - @jolly-pixel/resize-handle@1.2.1

## 3.1.0

### Minor Changes

- [#739](https://github.com/JollyPixel/editor/pull/739) [`f7b4ec2`](https://github.com/JollyPixel/editor/commit/f7b4ec2fea370220bba2d2ca68f0cb570ed80fcf) Thanks [@fraxken](https://github.com/fraxken)! - Restyle the `jolly-dialog` header as a filled banner and add `icon`, `tone` and
  `intent` (`info`, `success`, `warning`, `danger`), also accepted by the dialog
  helpers. The backdrop now takes the hue of the header.

- [#739](https://github.com/JollyPixel/editor/pull/739) [`956a942`](https://github.com/JollyPixel/editor/commit/956a942bec3670dc9cb0a9714a3abe2843330688) Thanks [@fraxken](https://github.com/fraxken)! - Add `jolly-dialog.confirmInline()`, which asks for a confirmation in the footer
  of the open dialog instead of stacking a second one.

- [#740](https://github.com/JollyPixel/editor/pull/740) [`566c46f`](https://github.com/JollyPixel/editor/commit/566c46f6a0ecab46dd1950f747a1fdb3e764d46a) Thanks [@fraxken](https://github.com/fraxken)! - Add `share-tone` to `jolly-dock`: every pane of the dock, both columns of a `double` one included, takes the tone of its first toned pane on screen.
  `jolly-pane` gains `ownTone`; `areaTone` now returns the shared tone inside such a dock.

- [#746](https://github.com/JollyPixel/editor/pull/746) [`60d0df3`](https://github.com/JollyPixel/editor/commit/60d0df3699f65c5dc38bff6a2458db1c2f05bee0) Thanks [@fraxken](https://github.com/fraxken)! - Export the facade builder types and add `addNote`, `addThemePreferences`,
  `addElement`, `DockFacade.query`, the `buttons` and `flags` binding views, and
  `FieldBinding` for Lit templates. Disposing a floating `Pane` now removes its
  `jolly-scope`.

- [#739](https://github.com/JollyPixel/editor/pull/739) [`267f172`](https://github.com/JollyPixel/editor/commit/267f172136cd77d1b16b67e3734ff068b65d2fb0) Thanks [@fraxken](https://github.com/fraxken)! - Add icon tones: `registerIcon(name, glyph, { tone })` with `tone-fill` and
  `tone-ink` glyph classes, seven `--jolly-tone-*` hues, and toned panes that
  recolour their header, tabs, folders and accent controls. Add `disabled` to
  `jolly-pane`, which also disables its `jolly-pane-group` tab.

- [#748](https://github.com/JollyPixel/editor/pull/748) [`54c361c`](https://github.com/JollyPixel/editor/commit/54c361c02b8f7ddf26cf71e0453f8f224566cffc) Thanks [@fraxken](https://github.com/fraxken)! - Own performance metrics in the runtime: a subsystem describes what it counts
  through the structural `MetricSource`, `runtime.metrics` registers it on one
  recorder, and `mountMetricsPanel()` builds a dockable readout from them.

- [#737](https://github.com/JollyPixel/editor/pull/737) [`94c4da8`](https://github.com/JollyPixel/editor/commit/94c4da893f24adfbf59d1031d3c3731c9b4ff567) Thanks [@fraxken](https://github.com/fraxken)! - `jolly-tab` gains `badge`, `action` and `actionLabel`; the action button emits `jolly-tab-action` without selecting the tab.
  `jolly-tabs` gains a `list-end` slot that follows the last tab outside the scrolling list, and a `variant="skew"` chained-parallelogram look.
  New `--jolly-tab-badge-bg` and `--jolly-tab-badge-fg` tokens tint the badge amber per theme.

- [#722](https://github.com/JollyPixel/editor/pull/722) [`d6e1b5a`](https://github.com/JollyPixel/editor/commit/d6e1b5a976b4571d78051502df570e85d5b50cce) Thanks [@fraxken](https://github.com/fraxken)! - Add `promptPeerIdentity` and `GUEST_USERNAME`, plus `toPeerMetadata`, `readUsername`, `readPeerId` and `peerProfileColor` under `./network`.

- [#726](https://github.com/JollyPixel/editor/pull/726) [`2bb278b`](https://github.com/JollyPixel/editor/commit/2bb278b095453aa8bf1e66c4d5fb36b98a9647cb) Thanks [@fraxken](https://github.com/fraxken)! - Add `PeerRoster` and `PeerMarkTracker` to `@jolly-pixel/ui/network`, moved out of the voxel-map and voxel-model editors.

### Patch Changes

- [#713](https://github.com/JollyPixel/editor/pull/713) [`4ae4d68`](https://github.com/JollyPixel/editor/commit/4ae4d683df8328d306023260732c1efc787acd98) Thanks [@fraxken](https://github.com/fraxken)! - Fix the vertical `jolly-slider` padding: an unlabeled slider no longer gets a start-only inset,
  and the empty trailing slot no longer adds a gap below the lane.
- Updated dependencies [[`8d2c08f`](https://github.com/JollyPixel/editor/commit/8d2c08f484a8ab7b1ef055c6d45c8267f7c6fc6d), [`6321913`](https://github.com/JollyPixel/editor/commit/632191387a3708bbefaebfc8f59bf0c105c4f242), [`6321913`](https://github.com/JollyPixel/editor/commit/632191387a3708bbefaebfc8f59bf0c105c4f242)]:
  - @jolly-pixel/network@4.0.0

## 3.0.0

### Major Changes

- [#665](https://github.com/JollyPixel/editor/pull/665) [`25fd361`](https://github.com/JollyPixel/editor/commit/25fd361714e6bb55f8fa61f0404d85a055e245f7) Thanks [@fraxken](https://github.com/fraxken)! - Add `jolly-pane-group`: dock layouts store panes as tab groups, a dragged pane joins a group when dropped on a header or tab strip, and `jolly-pane-visibility` reports shown panes.
  An empty dock is now a placeholder from its first render and previews its size while a drag arms it.
  `jolly-pane` gains an `icon`, shown in its header and its group tab.

### Minor Changes

- [#678](https://github.com/JollyPixel/editor/pull/678) [`60bef9d`](https://github.com/JollyPixel/editor/commit/60bef9d4d51f63a269e31f26d1817399708f8b6a) Thanks [@fraxken](https://github.com/fraxken)! - Add `closable` and `tooltip` to `jolly-tab`: a closable tab emits `jolly-tab-close` with `{ value }`, and `jolly-tabs` re-renders when tab properties change.
  Add the `catalogMaxContentBytes` backend option to raise or lower the `catalog:create` size cap.

- [#668](https://github.com/JollyPixel/editor/pull/668) [`ab65462`](https://github.com/JollyPixel/editor/commit/ab65462597390541cdb2bee98a7aa22dff562c69) Thanks [@fraxken](https://github.com/fraxken)! - Add `layout="wide"` to `jolly-color-picker`: a height-filling row with vertical hue and alpha tracks and editable R/G/B, H/S/L, A and hex fields.
  Add `hsvToHsl()` and `hslToHsv()` to `@jolly-pixel/color`, keeping hue on grays and saturation through black.

- [#696](https://github.com/JollyPixel/editor/pull/696) [`2fbcaeb`](https://github.com/JollyPixel/editor/commit/2fbcaeb78ac80e4ce706ae66c2c6203513d439c4) Thanks [@fraxken](https://github.com/fraxken)! - `jolly-dialog` gains `headingEditable`, which renders the heading as a
  content-sized title input and emits `jolly-heading-change` on commit.
  The header now carries a faint `--jolly-dialog-chrome-bg` tint, and both header
  and footer take the density-scaled `--jolly-dialog-chrome-padding`.
  Fields gain `--jolly-field-inset-start`, and a field's description no longer
  inherits the text alignment that a reflected `align` attribute hints at.

- [#682](https://github.com/JollyPixel/editor/pull/682) [`d8f9e21`](https://github.com/JollyPixel/editor/commit/d8f9e21ba3dfb92135c83f909e542b8cbe668fa7) Thanks [@fraxken](https://github.com/fraxken)! - `jolly-dialog`, the `jolly-color` picker and control details now fade and scale in and out, tuned by `--jolly-duration-enter`, `--jolly-duration-exit`, `--jolly-easing-overlay` and `--jolly-overlay-scale`.
  Dialog helpers stay in the DOM until the exit transition ends. Reduced motion disables the transitions.

- [#683](https://github.com/JollyPixel/editor/pull/683) [`c9c7379`](https://github.com/JollyPixel/editor/commit/c9c7379f0e9e1255eb1fb8f88bc660fec32c249a) Thanks [@fraxken](https://github.com/fraxken)! - Add `floatWidth`/`floatHeight` to `jolly-pane` to size the window a pane opens when first dragged out of its dock; hidden tabs now fall back to their group size instead of 160x80.
  Add `hidden`, `floatWidth` and `floatHeight` options to the `Pane` facade.

- [#678](https://github.com/JollyPixel/editor/pull/678) [`60bef9d`](https://github.com/JollyPixel/editor/commit/60bef9d4d51f63a269e31f26d1817399708f8b6a) Thanks [@fraxken](https://github.com/fraxken)! - Add `jolly-spinner`, an indeterminate busy indicator for work with no known
  duration, sized from `--jolly-spinner-size` and exported from the `feedback`
  entry alongside `jolly-progress`.

- [#684](https://github.com/JollyPixel/editor/pull/684) [`3b06ff8`](https://github.com/JollyPixel/editor/commit/3b06ff841b592848f538af79b60b75456d7d5842) Thanks [@fraxken](https://github.com/fraxken)! - Add `double` to `jolly-dock`: a left or right dock can open a second column, which doubles its width and splits it equally between the two columns.
  `DockState` gains `secondary`, `PanePlacement` gains `column`, and `movePane`/`stackPane` accept a `DockAddress` (`{ dock, column }`).

- [#656](https://github.com/JollyPixel/editor/pull/656) [`be5e8bf`](https://github.com/JollyPixel/editor/commit/be5e8bfa64d4a0b17dfac90ab37ec6e9208330d1) Thanks [@fraxken](https://github.com/fraxken)! - Add `InputLayers` and the shared `inputLayers`: an open `jolly-dialog` or `PopoverController` popover claims keydown and keypress events.
  Pass `inputLayers` to `Keyboard.addGuard()` so viewport controls ignore keys pressed inside dialogs and popovers.

- [#646](https://github.com/JollyPixel/editor/pull/646) [`2371afa`](https://github.com/JollyPixel/editor/commit/2371afaaff5dd986b36c3ea20a101146ec12b795) Thanks [@fraxken](https://github.com/fraxken)! - `MetricDefinition.palette` colors any metric, and `jolly-dock-layout` now keeps one snapshot, with children reporting typed `LayoutChange` details.
  Numeric inputs share one entry policy (slider readouts step with arrow keys, axis parse errors show on the field), and components share one default storage adapter.

- [#682](https://github.com/JollyPixel/editor/pull/682) [`15f358a`](https://github.com/JollyPixel/editor/commit/15f358a223cd8fc57d10b9a800a5b5b2edcb0268) Thanks [@fraxken](https://github.com/fraxken)! - Add `showChoice()`, a dialog helper that resolves the picked action value or `null`; `showConfirm()` now builds on it.

- [#644](https://github.com/JollyPixel/editor/pull/644) [`c1d08b8`](https://github.com/JollyPixel/editor/commit/c1d08b8ee5c6d196172c623b0906b10d1061ab40) Thanks [@fraxken](https://github.com/fraxken)! - Add `jolly-tool-button`, a square rail button with an optional hover flyout, and a `vertical` orientation for `jolly-slider`.

- [#686](https://github.com/JollyPixel/editor/pull/686) [`73b40f6`](https://github.com/JollyPixel/editor/commit/73b40f63553c35fbda9fcd6cc6ed472a63cabebb) Thanks [@fraxken](https://github.com/fraxken)! - Add `iconOnly` (`icon-only`) to `jolly-button-group` to show only segment icons, keeping labels as tooltips and accessible names.
  Fix `jolly-tree` row layout: leaf rows highlight their full width, with inner padding set by `--jolly-tree-row-padding-inline`.

- [#693](https://github.com/JollyPixel/editor/pull/693) [`6895753`](https://github.com/JollyPixel/editor/commit/6895753c6e09c43758357ee5997b981ce5c401ac) Thanks [@fraxken](https://github.com/fraxken)! - Rename `VoxelDebugger` to `VoxelInspector` (`engine.inspector`, `inspector` option); mesh counters move to `inspector.mesh.stats`.
  Add block statistics: `inspector.blocks` (per layer, per block, unused, orphans, tileset usage) and `countBlocks()`/`countBlock()`/`voxelCount` on `VoxelWorld` and `VoxelLayer`.
  Add `TreeNode.detail` to `jolly-tree` for a muted trailing row text.

### Patch Changes

- [#682](https://github.com/JollyPixel/editor/pull/682) [`bd77308`](https://github.com/JollyPixel/editor/commit/bd773087b83d357491bd56e0e3d60808f2ee5434) Thanks [@fraxken](https://github.com/fraxken)! - Dialog helpers now resolve on `jolly-close` instead of `jolly-cancel`, so on Escape they resolve after focus has returned to the opener.

- [#655](https://github.com/JollyPixel/editor/pull/655) [`bb3e894`](https://github.com/JollyPixel/editor/commit/bb3e89489f37e83b2435b3d41fa208e2e53aa3ad) Thanks [@fraxken](https://github.com/fraxken)! - Keep overlay docks click-through when page CSS sets `pointer-events` on `jolly-dock`, and disable the resize strip of an empty overlay dock.
  Panes, floating windows, controls and solid docks now declare `pointer-events: auto`, so they work inside a `pointer-events: none` layer.

- [#664](https://github.com/JollyPixel/editor/pull/664) [`271fba9`](https://github.com/JollyPixel/editor/commit/271fba955fe79253b972a13daf0419a696138788) Thanks [@fraxken](https://github.com/fraxken)! - Replace `SyncAdapter` with `CommandSync`, add `PresenceChannel`, and slim `ConflictTracker` to `admit`/`admitEach`; presence set before `join()` now travels with the join.
  Asset rooms stamp the sender's `clientId` server-side, and three's peer syncs drop `resyncIntervalMs` and their message type parameters.

- [#677](https://github.com/JollyPixel/editor/pull/677) [`1e16c34`](https://github.com/JollyPixel/editor/commit/1e16c343d63da08745ad1fdeb12c3dd83364e573) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - Fix `jolly-tree` selection and drag-and-drop: clicking empty space below the rows now deselects, dropping below the last row can land as its last child, and row hover/selection highlighting no longer bleeds into the toggle and grip buttons.
- Updated dependencies [[`d61e341`](https://github.com/JollyPixel/editor/commit/d61e341ffbe1f555237cf0b586d628bf5c94c82f), [`ab65462`](https://github.com/JollyPixel/editor/commit/ab65462597390541cdb2bee98a7aa22dff562c69), [`55a1230`](https://github.com/JollyPixel/editor/commit/55a12309b7e3d4a3c7ba7efc47766655abaf10f9), [`ae6293b`](https://github.com/JollyPixel/editor/commit/ae6293bf83ef24d0e91569994594a87221577ea2), [`271fba9`](https://github.com/JollyPixel/editor/commit/271fba955fe79253b972a13daf0419a696138788)]:
  - @jolly-pixel/network@3.0.0
  - @jolly-pixel/color@1.1.0

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
