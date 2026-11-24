# @jolly-pixel/controls

## 4.1.0

### Minor Changes

- [#1267](https://github.com/JollyPixel/editor/pull/1267) [`5ec2390`](https://github.com/JollyPixel/editor/commit/5ec2390787654fd01c32d016ab76ef9f083da4b3) Thanks [@fraxken](https://github.com/fraxken)! - Rename `NavigatorAdapter.getGamepads()` to `pollGamepads()`; custom navigator adapters passed to `Gamepad` must rename the method.

## 4.0.0

### Major Changes

- [#1047](https://github.com/JollyPixel/editor/pull/1047) [`5d9e5a4`](https://github.com/JollyPixel/editor/commit/5d9e5a484c5e7ce27d7d702bc2fe05df495bbc19) Thanks [@fraxken](https://github.com/fraxken)! - Input devices share one edge bank, so a tap between two samples reports both edges, and fullscreen works on touch. Several deprecated members are removed; use `bindInputCondition()` instead of condition `bind()`.

- [#849](https://github.com/JollyPixel/editor/pull/849) [`5f66fe9`](https://github.com/JollyPixel/editor/commit/5f66fe99d7d1b7cb1df7c1383f2fa60ba6acf6cd) Thanks [@fraxken](https://github.com/fraxken)! - Replace `publishFrameState()` with `publish(reader)`, so fixed-step and frame readers each see every input edge once.

- [#1024](https://github.com/JollyPixel/editor/pull/1024) [`9123c45`](https://github.com/JollyPixel/editor/commit/9123c4578d791cb8f9d3749e56d2c8268ee87ec7) Thanks [@fraxken](https://github.com/fraxken)! - Rename methods named `xOf`, `xFor` or `getX`/`setX` after what they do (for example `inverseOf` → `invert`, `UVRegion.rectFor` → `slotRect`, `MessageParser.of` → `fromProtocol`).
  The package docs list the new names; behavior is unchanged.

### Minor Changes

- [#1061](https://github.com/JollyPixel/editor/pull/1061) [`d225112`](https://github.com/JollyPixel/editor/commit/d2251127dac7d6b2ca8f4bf123331062156d645f) Thanks [@fraxken](https://github.com/fraxken)! - `OrbitFlyCamera` takes its keys from `OrbitFlyKeys`, and tours can show the key bound to an action.

- [#1075](https://github.com/JollyPixel/editor/pull/1075) [`6d8484f`](https://github.com/JollyPixel/editor/commit/6d8484fe99f34f8ed90b407fc6e657c0387c1acf) Thanks [@fraxken](https://github.com/fraxken)! - Add `ShortcutLabels`, which writes tooltip text such as `Undo (Ctrl+Z)` from the chords a `KeyBindingSettings` binds, on the current keyboard layout, and notifies on each rebind or layout change.

- [#1038](https://github.com/JollyPixel/editor/pull/1038) [`ce42278`](https://github.com/JollyPixel/editor/commit/ce42278634922401f293644c76ee55b71ae041db) Thanks [@fraxken](https://github.com/fraxken)! - Add `KeyBindingSettings` to load and persist rebound shortcuts.

- [#984](https://github.com/JollyPixel/editor/pull/984) [`51c9b58`](https://github.com/JollyPixel/editor/commit/51c9b58a6d5d6f279413d82be26c9d92609905c9) Thanks [@fraxken](https://github.com/fraxken)! - `Mouse.scrollSource` tells wheel, touchpad swipe and pinch apart, and `OrbitFlyCamera` looks around on a two-finger swipe and eases in and out of movement.

## 3.0.0

### Major Changes

- [#832](https://github.com/JollyPixel/editor/pull/832) [`bd7b3d3`](https://github.com/JollyPixel/editor/commit/bd7b3d3c346826673e9de8d14286a8573c253fe1) Thanks [@fraxken](https://github.com/fraxken)! - `ExtendedKeyCode` no longer accepts lowercase letters: use `"W"` or `"KeyW"` instead of `"w"` in `isDown()`, `InputCombination.key()`, `AliasedKeyInput`, `Axis.buttons()` and `Camera3DControls` bindings.

### Minor Changes

- [#833](https://github.com/JollyPixel/editor/pull/833) [`f54d006`](https://github.com/JollyPixel/editor/commit/f54d006a7c16e9d2cca6cf6fec6076053ac86335) Thanks [@fraxken](https://github.com/fraxken)! - Add `KeyBindingMap` for rebindable shortcuts, and sliders and checkboxes no longer block shortcuts.

- [#845](https://github.com/JollyPixel/editor/pull/845) [`399e1e4`](https://github.com/JollyPixel/editor/commit/399e1e448a7cab33990ccb000c381ec266060de5) Thanks [@fraxken](https://github.com/fraxken)! - Add `renderOnDemand` to `Runtime`: the loop sleeps when nothing changes, and cameras, voxel views and peer syncs request the frames they need. Room joins load a much smaller snapshot.

- [#829](https://github.com/JollyPixel/editor/pull/829) [`56c4d56`](https://github.com/JollyPixel/editor/commit/56c4d566330c6851b52b6dd64b0bdd3f69946dfb) Thanks [@fraxken](https://github.com/fraxken)! - `Keyboard.bind()` binds key chords with priorities, and `KeyChord` parses, matches and formats chords by key position or printed letter.

### Patch Changes

- [#789](https://github.com/JollyPixel/editor/pull/789) [`b520e7e`](https://github.com/JollyPixel/editor/commit/b520e7e37c000763a492f68635af528ca461a285) Thanks [@fraxken](https://github.com/fraxken)! - Package subpaths follow one naming scheme (`/node`, `/client`, `/browser`), and every package declares `exports`; for example, import `event-store/node` instead of `event-store/sqlite`. Package roots are browser-safe.

## 2.1.0

### Minor Changes

- [#654](https://github.com/JollyPixel/editor/pull/654) [`0f3d193`](https://github.com/JollyPixel/editor/commit/0f3d1934381596fb60430044f898d60679713945) Thanks [@fraxken](https://github.com/fraxken)! - Add `AliasedKeyInput` and predefined `InputCombination` presets (`Control`, `Shift`, `Alt`, `Meta`, `Mod`, `Enter`, `Move*`) that treat paired keys as one logical key.

- [#650](https://github.com/JollyPixel/editor/pull/650) [`b18fbfa`](https://github.com/JollyPixel/editor/commit/b18fbfa2df86f72d4e035408867fdb1015fcdc30) Thanks [@fraxken](https://github.com/fraxken)! - Add `bind(input)` to input conditions and `bindInputCondition()`, returning a callable `BoundInputCondition` that keeps the `Input` in a closure.

- [#651](https://github.com/JollyPixel/editor/pull/651) [`b443728`](https://github.com/JollyPixel/editor/commit/b443728ce75d4f1447d8234247d0578d58407e7d) Thanks [@fraxken](https://github.com/fraxken)! - Add `InputCombination.hold()` and `HoldInput` so sequence steps can be required to stay held.

- [#656](https://github.com/JollyPixel/editor/pull/656) [`be5e8bf`](https://github.com/JollyPixel/editor/commit/be5e8bfa64d4a0b17dfac90ab37ec6e9208330d1) Thanks [@fraxken](https://github.com/fraxken)! - Add `Keyboard.addGuard()` and the `KeyboardGuard` port, so another input owner can block keydown and keypress events and release held keys when it engages.

### Patch Changes

- [#653](https://github.com/JollyPixel/editor/pull/653) [`ba79012`](https://github.com/JollyPixel/editor/commit/ba79012690fb47e9c035a028e9b876fb3f92769a) Thanks [@fraxken](https://github.com/fraxken)! - Accept lowercase letter shorthands and mouse `"ANY"`/`"NONE"` sentinels in types, validate the state segment in `isCombinedAction()`, and exclude sentinels from `InputActionQuery.value`.

## 2.0.0

### Major Changes

- [#514](https://github.com/JollyPixel/editor/pull/514) [`cd200eb`](https://github.com/JollyPixel/editor/commit/cd200ebf5440b27cecc74221104deae7e7bf9be6) Thanks [@fraxken](https://github.com/fraxken)! - Drop the `get`/`set` prefixes from device methods.

- [#515](https://github.com/JollyPixel/editor/pull/515) [`29c5ecb`](https://github.com/JollyPixel/editor/commit/29c5ecb28e364f5d9a96f787647c6dfd3d7b1454) Thanks [@fraxken](https://github.com/fraxken)! - Optimize the per-frame and query hot paths: idle devices skip `update()`, mouse position reads avoid forced layout, and queries no longer allocate.

### Minor Changes

- [#529](https://github.com/JollyPixel/editor/pull/529) [`2db69a8`](https://github.com/JollyPixel/editor/commit/2db69a870c0ef3f5375c53cf2661ef23d43584a4) Thanks [@fraxken](https://github.com/fraxken)! - Add `Mouse.scroll` for signed wheel magnitude and keep drags alive once the
  cursor leaves the canvas. `Runtime.load()`/`configureRuntimeDevice` accept
  `maxFps` to override the GPU-benchmarked render cap.

- [#571](https://github.com/JollyPixel/editor/pull/571) [`c9fa209`](https://github.com/JollyPixel/editor/commit/c9fa2090fc08b3151f107290459dbd050a584186) Thanks [@fraxken](https://github.com/fraxken)! - `Mouse.hovering` tells whether the pointer is over the canvas. Peer voxel edits reach local observers.

- [#559](https://github.com/JollyPixel/editor/pull/559) [`981f340`](https://github.com/JollyPixel/editor/commit/981f340f5933b21508a8b5acca991c8e44b451d0) Thanks [@fraxken](https://github.com/fraxken)! - Add `AxisMap`, `Axis`, and normalized axis sources for named movement input.
  Export `AtomicInput` and its action types, including `ANY` and `NONE` keyboard
  sentinels.

### Patch Changes

- [#610](https://github.com/JollyPixel/editor/pull/610) [`6ec74fd`](https://github.com/JollyPixel/editor/commit/6ec74fdc2662bb3a2dc3744edcd1d2b9dc80ae24) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - `FreeFlyCamera` gains an opt-in orbit focus mode (`focusMode: "lock" | "elastic"`). Alt+key combos no longer trigger browser shortcuts.

- [#524](https://github.com/JollyPixel/editor/pull/524) [`82ce3e8`](https://github.com/JollyPixel/editor/commit/82ce3e8139f436f25676c1b7bcd8447e1b4db416) Thanks [@fraxken](https://github.com/fraxken)! - Preserve mouse transitions across fixed-step samples and rendered updates.
