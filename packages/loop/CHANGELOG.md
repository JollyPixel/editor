# @jolly-pixel/loop

## 2.0.0

### Major Changes

- [#846](https://github.com/JollyPixel/editor/pull/846) [`f949b80`](https://github.com/JollyPixel/editor/commit/f949b807ba586adee8b88f476261334eef8a703a) Thanks [@fraxken](https://github.com/fraxken)! - Rename `RafFrameSource` to `RequestAnimationFrameSource` (and `RafFrameSourceOptions` to `RequestAnimationFrameSourceOptions`).

### Minor Changes

- [#1012](https://github.com/JollyPixel/editor/pull/1012) [`837a08f`](https://github.com/JollyPixel/editor/commit/837a08fc80a0b41a1f2c0549fff8f6423db9066b) Thanks [@fraxken](https://github.com/fraxken)! - Smoother frame pacing on jittery displays, and `FrameRateGovernor` halves the render rate while frames keep missing their refresh.

- [#849](https://github.com/JollyPixel/editor/pull/849) [`5f66fe9`](https://github.com/JollyPixel/editor/commit/5f66fe99d7d1b7cb1df7c1383f2fa60ba6acf6cd) Thanks [@fraxken](https://github.com/fraxken)! - Add time scale and `GameLoop.step()` for frame-by-frame debugging. Cameras move in wall-clock time, so they work in slow motion and while paused.

- [#908](https://github.com/JollyPixel/editor/pull/908) [`0436e3c`](https://github.com/JollyPixel/editor/commit/0436e3c645a2d717b90bb407ce41eb412beb4943) Thanks [@fraxken](https://github.com/fraxken)! - Add `renderDelta`/`unscaledRenderDelta` so `update` and `world.time` include frames skipped by `maxFps`; renders land on the nearest frame so a cap at the display rate no longer drops frames.

- [#1017](https://github.com/JollyPixel/editor/pull/1017) [`02ab0a3`](https://github.com/JollyPixel/editor/commit/02ab0a3a9eeef46f26b5d45846c057249729b3c3) Thanks [@fraxken](https://github.com/fraxken)! - `GameLoop` takes an `idleDelay` before it sleeps. The runtime sets it to 2 s with `renderOnDemand` in place of rendering every frame while the pointer hovers the canvas.
  `StatsRecorder.skipGap()` keeps the time the loop slept out of the FPS graph.

## 1.1.0

### Minor Changes

- [#845](https://github.com/JollyPixel/editor/pull/845) [`399e1e4`](https://github.com/JollyPixel/editor/commit/399e1e448a7cab33990ccb000c381ec266060de5) Thanks [@fraxken](https://github.com/fraxken)! - Add `renderOnDemand` to `Runtime`: the loop sleeps when nothing changes, and cameras, voxel views and peer syncs request the frames they need. Room joins load a much smaller snapshot.

- [#841](https://github.com/JollyPixel/editor/pull/841) [`71d300a`](https://github.com/JollyPixel/editor/commit/71d300a76e87200b52cb4a1e9394ce22793c2a8a) Thanks [@fraxken](https://github.com/fraxken)! - Add `suspendWhenHidden` to pause the loop while the page is hidden. `load({ maxFps })` skips GPU benchmarking.

### Patch Changes

- [#789](https://github.com/JollyPixel/editor/pull/789) [`b520e7e`](https://github.com/JollyPixel/editor/commit/b520e7e37c000763a492f68635af528ca461a285) Thanks [@fraxken](https://github.com/fraxken)! - Package subpaths follow one naming scheme (`/node`, `/client`, `/browser`), and every package declares `exports`; for example, import `event-store/node` instead of `event-store/sqlite`. Package roots are browser-safe.
