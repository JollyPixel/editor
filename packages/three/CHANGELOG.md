# @jolly-pixel/three

## 2.0.0

### Major Changes

- [#550](https://github.com/JollyPixel/editor/pull/550) [`e282c08`](https://github.com/JollyPixel/editor/commit/e282c08f6857bc99dc33f343a831395d0e8716fd) Thanks [@fraxken](https://github.com/fraxken)! - Rename `PeerFrustumSyncOptions.getLabel` and `getColor` to `label` and `color`,
  aligning the presence helpers with the repository naming rule that forbids a
  `get` prefix on non-accessor members.

### Minor Changes

- [#531](https://github.com/JollyPixel/editor/pull/531) [`7701ab0`](https://github.com/JollyPixel/editor/commit/7701ab0419a2aefca91c805f8fc52e3f494a526e) Thanks [@fraxken](https://github.com/fraxken)! - Expose `PeerFrustumSync` from a new `@jolly-pixel/three/network` entry point,
  with `@jolly-pixel/network` as an optional peer dependency.

- [#627](https://github.com/JollyPixel/editor/pull/627) [`deee8d4`](https://github.com/JollyPixel/editor/commit/deee8d4ebd3f3cb34d5e16c448a81f7cab0c378d) Thanks [@fraxken](https://github.com/fraxken)! - Add `Grid.extent`, `Grid.toOptions()`, and `Grid.cloneWith()` to read a grid's live state back as `GridOptions` and rebuild it with per-field overrides.
  Callers no longer need to copy every property by hand when changing a construction-only setting such as `plane`, `cell.style`, or `fade.from`.

- [#614](https://github.com/JollyPixel/editor/pull/614) [`0b785c2`](https://github.com/JollyPixel/editor/commit/0b785c2a1e7c12d40252475bfbb79d103fdb2c9d) Thanks [@fraxken](https://github.com/fraxken)! - Stop allocating peer colors in `PeerFrustumSync`. Without a `color` callback
  every peer now uses `frustum.color` (which the `frustum` option finally
  accepts), falling back to `PeerFrustum.Defaults.color`, and `@jolly-pixel/color`
  is no longer a runtime dependency.
  Export `createDefaultColorAllocator()`, previously duplicated inside
  `PeerSelectionRegistry` and `PeerHoverRegistry`.

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

- [#568](https://github.com/JollyPixel/editor/pull/568) [`33cba8e`](https://github.com/JollyPixel/editor/commit/33cba8e750bdd4cac96f409c3cf310159f73ad20) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - Trim the selection public surface to its user-facing components: the internal
  overlay plumbing, factories and helpers are no longer exported. The global
  `defaultSelectionOverlayRegistry` is replaced by a per-instance
  `SelectionManager.overlayRegistry`, and `createSelectionOverlay` becomes
  `SelectionOverlayRegistry.create`.

- [#598](https://github.com/JollyPixel/editor/pull/598) [`a5c560b`](https://github.com/JollyPixel/editor/commit/a5c560bc21d123906a8c7faa6a3d7ed783e89b4f) Thanks [@fraxken](https://github.com/fraxken)! - Add customizable axis-only translation controls with outlined arrow or sphere
  handles, an optional visual center, world/local dragging, and relative snapping.

- [#533](https://github.com/JollyPixel/editor/pull/533) [`999a690`](https://github.com/JollyPixel/editor/commit/999a69089d9c7a354eba3058802a64880cefda19) Thanks [@fraxken](https://github.com/fraxken)! - Add `AreaBox`, a translucent axis-aligned area anchored on its min corner, and
  `AreaBoxControls`, pointer controls that drag it on the ground plane and resize
  one face at a time with grid snapping, per-axis policies and bounds.

- [#539](https://github.com/JollyPixel/editor/pull/539) [`3bde59b`](https://github.com/JollyPixel/editor/commit/3bde59b0a25d61653b3200849c64bf93c3d30c8d) Thanks [@fraxken](https://github.com/fraxken)! - Rebuild the layers tab around one tree holding objects as rows, with a single
  add dialog, per-object color and lock, and editable properties. Adds
  `AreaBox.color`, `VoxelObjectJSON.color`/`locked`, and stops `disposeObject3D`
  freeing the resources a self-disposing node already released.

- [#595](https://github.com/JollyPixel/editor/pull/595) [`245bc85`](https://github.com/JollyPixel/editor/commit/245bc850a6f0798459b2e829ad99add3e0510c54) Thanks [@fraxken](https://github.com/fraxken)! - Clicking a collaborator in the voxel-map presence panel teleports the camera to
  their position and orientation, through a `selectable` opt-in on
  `jolly-presence` and `PeerFrustumSync.poseOf()`. Peer frustums now fade out up
  close, and the color swatch loses its border.

### Patch Changes

- [#539](https://github.com/JollyPixel/editor/pull/539) [`3bde59b`](https://github.com/JollyPixel/editor/commit/3bde59b0a25d61653b3200849c64bf93c3d30c8d) Thanks [@fraxken](https://github.com/fraxken)! - Stop faulting the WebGPU queue from object-layer edits: `AreaBoxEdges.resize()`
  drops a resize to the size it already traces, and hiding an object or a layer
  now flips `visible` instead of disposing the area mid-frame.

- [#568](https://github.com/JollyPixel/editor/pull/568) [`33cba8e`](https://github.com/JollyPixel/editor/commit/33cba8e750bdd4cac96f409c3cf310159f73ad20) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - Remove every type assertion from the selection sources: `HighlightEntry` is now
  a discriminated union on `instanceId`, and the peer registries type their
  `addEventListener`/`removeEventListener` on a per-class event map.

- [#551](https://github.com/JollyPixel/editor/pull/551) [`5b7385f`](https://github.com/JollyPixel/editor/commit/5b7385fd3e4e3d4f4f342d6d8296d1211103bace) Thanks [@fraxken](https://github.com/fraxken)! - Stop `AreaBoxEdges` faulting the WebGPU queue on a canvas resize: the material
  is now transparent only below a full opacity, so fully opaque edges no longer
  pull in the full-screen opaque copy that three recreates mid render pass.
- Updated dependencies [[`d6f6a22`](https://github.com/JollyPixel/editor/commit/d6f6a22e8d9a5644b1e27622aa00d5e1af594702), [`c9fa209`](https://github.com/JollyPixel/editor/commit/c9fa2090fc08b3151f107290459dbd050a584186), [`423db10`](https://github.com/JollyPixel/editor/commit/423db105df46e6ec7bb692beec0a37b1f9332fad), [`02b3b44`](https://github.com/JollyPixel/editor/commit/02b3b44814abf14c24bfea237afababa6ff8b09c), [`a9a6ca8`](https://github.com/JollyPixel/editor/commit/a9a6ca8279097ff6e64a800f797a96ab21597e1b)]:
  - @jolly-pixel/network@2.0.0

## 1.1.0

### Minor Changes

- [#405](https://github.com/JollyPixel/editor/pull/405) [`b2e9605`](https://github.com/JollyPixel/editor/commit/b2e960595e4106830419405c82edbbaa7a0e6880) Thanks [@fraxken](https://github.com/fraxken)! - Implement the first Grid component/utility

- [#456](https://github.com/JollyPixel/editor/pull/456) [`fd85f2c`](https://github.com/JollyPixel/editor/commit/fd85f2cfa0b25e60b312177d0367b926ec3c1236) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - Feature: add PeerFustrum as Peer representation in 3D editors with multi support

- [#412](https://github.com/JollyPixel/editor/pull/412) [`c7e3e18`](https://github.com/JollyPixel/editor/commit/c7e3e181578e18ee94b99a6172cdbfba6a6b1257) Thanks [@fraxken](https://github.com/fraxken)! - Implement performance stats for Grid + Missing dispose() method

- [#458](https://github.com/JollyPixel/editor/pull/458) [`cf91f93`](https://github.com/JollyPixel/editor/commit/cf91f9336c32d8cc709a7915d2aa2fad264403c3) Thanks [@fraxken](https://github.com/fraxken)! - Cleanup three frustum implementation and introduce new PresenceOnlyExtension to network package

- [#408](https://github.com/JollyPixel/editor/pull/408) [`f4513d5`](https://github.com/JollyPixel/editor/commit/f4513d5bab6d365f0ab3c3d85c3902859b0bcb83) Thanks [@fraxken](https://github.com/fraxken)! - Implement new options to Grid utility
