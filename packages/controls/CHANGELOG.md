# @jolly-pixel/controls

## 2.0.0

### Major Changes

- [#514](https://github.com/JollyPixel/editor/pull/514) [`cd200eb`](https://github.com/JollyPixel/editor/commit/cd200ebf5440b27cecc74221104deae7e7bf9be6) Thanks [@fraxken](https://github.com/fraxken)! - Drop the `get`/`set` prefixes from device methods.

- [#515](https://github.com/JollyPixel/editor/pull/515) [`29c5ecb`](https://github.com/JollyPixel/editor/commit/29c5ecb28e364f5d9a96f787647c6dfd3d7b1454) Thanks [@fraxken](https://github.com/fraxken)! - Optimize the per-frame and query hot paths: idle devices skip `update()`, mouse position reads avoid forced layout, and queries no longer allocate.

### Minor Changes

- [#529](https://github.com/JollyPixel/editor/pull/529) [`2db69a8`](https://github.com/JollyPixel/editor/commit/2db69a870c0ef3f5375c53cf2661ef23d43584a4) Thanks [@fraxken](https://github.com/fraxken)! - Add `Mouse.scroll` for signed wheel magnitude and keep drags alive once the
  cursor leaves the canvas. `Runtime.load()`/`configureRuntimeDevice` accept
  `maxFps` to override the GPU-benchmarked render cap.

- [#571](https://github.com/JollyPixel/editor/pull/571) [`c9fa209`](https://github.com/JollyPixel/editor/commit/c9fa2090fc08b3151f107290459dbd050a584186) Thanks [@fraxken](https://github.com/fraxken)! - `Mouse` tracks whether the pointer sits over the canvas as `hovering`, with
  `enter` and `leave` events, so a consumer can tell a live `position` from the
  stale one left behind when the pointer moves onto surrounding UI.
  `SyncAdapter.notifyLocal()` replays an event to the handler captured at
  `attach()`, which `VoxelSyncClient` now uses so a peer's edit reaches local
  observers, and hiding, showing or removing a layer marks every layer's chunks
  dirty for cross-layer face culling.

- [#559](https://github.com/JollyPixel/editor/pull/559) [`981f340`](https://github.com/JollyPixel/editor/commit/981f340f5933b21508a8b5acca991c8e44b451d0) Thanks [@fraxken](https://github.com/fraxken)! - Add `AxisMap`, `Axis`, and normalized axis sources for named movement input.
  Export `AtomicInput` and its action types, including `ANY` and `NONE` keyboard
  sentinels.

### Patch Changes

- [#610](https://github.com/JollyPixel/editor/pull/610) [`6ec74fd`](https://github.com/JollyPixel/editor/commit/6ec74fdc2662bb3a2dc3744edcd1d2b9dc80ae24) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - Add an opt-in orbit-focus mode to `FreeFlyCamera` (`focusMode: "lock" | "elastic"`).
  In "lock" mode, `enterOrbitFocus`/`exitOrbitFocus` engage a fixed, click-assigned
  pivot (wired up in voxel-map via Alt+LeftClick, Escape to release); while locked,
  WASD/arrows/Space/Shift smoothly nudge the pivot one cell at a time instead of
  moving the camera freely. In "elastic" mode, WASD/look instead pilot a free-floating pivot
  directly, and scroll smoothly trails the camera behind it, reaching the pivot
  exactly (free-fly) at zero; scroll eases the same way in "lock" mode.
  Alt+LeftClick-drag also rotates the view (in free-fly and
  while orbiting) as a touchpad-friendlier alternative to middle-drag. The two
  modes' state and math live in their own `OrbitFocus`/`ElasticFocus` classes.
  
  Add the missing "Escape" key code to `KeyCode`, and prevent the browser
  default for Alt+key combos (e.g. Chrome's Alt+D address-bar shortcut) so
  they no longer steal focus away from a running game or editor.

- [#524](https://github.com/JollyPixel/editor/pull/524) [`82ce3e8`](https://github.com/JollyPixel/editor/commit/82ce3e8139f436f25676c1b7bcd8447e1b4db416) Thanks [@fraxken](https://github.com/fraxken)! - Preserve mouse transitions across fixed-step samples and rendered updates.
