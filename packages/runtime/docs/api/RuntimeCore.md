# RuntimeCore

`@jolly-pixel/runtime/core` is the part of the runtime that imports neither
three.js nor the engine. `RuntimeCore` drives a `RuntimeBackend` with the same
loop, session, overlay, loading screen, and metrics as [`Runtime`](./Runtime.md),
which is the three.js runtime built on it.

```ts
import { RuntimeCore } from "@jolly-pixel/runtime/core";

const runtime = new RuntimeCore(canvas, backend, {
  renderOnDemand: true
});
await runtime.load({ scene: level });
```

## new RuntimeCore(canvas, backend, options?)

`options` takes every [`Runtime` option](./Runtime.md#options) that does not
concern three.js: `focusCanvas`, `focusHint`, `overlay`, `loop`,
`renderOnDemand`, and `suspendWhenHidden`. Its `logger` is any `RuntimeLogger`
and records nothing by default. For the corner HUD, call
`mountPerformanceStats()` with an `includePerformanceStats` value.

```ts
interface RuntimeLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  isNamespaceEnabled(): boolean;
  step<T>(
    name: string,
    run: () => Promise<T>,
    meta?: Record<string, unknown>
  ): Promise<T>;
}
```

Properties and methods are the ones listed on the [`Runtime`](./Runtime.md)
page. `load()` takes the scene type of the backend. `Runtime` adds `renderer`,
`manager`, `viewHelper`, and `compiledFrame()`.

## RuntimeBackend

```ts
interface RuntimeBackend<TWorld, TScene, TMetrics> {
  readonly world: TWorld;
  readonly frameSource: FrameSource;
  readonly metrics: TMetrics; // runtime.metrics.renderer

  adaptPixelRatio(ratio: number): void;
  loadScene(
    scene: TScene,
    onProgress: (progress: RuntimeSceneProgress) => void
  ): Promise<void>;
  start(): void;
  stop(): void;
  dispose(): void;
}
```

- `frameSource` drives `runtime.loop`.
- `metrics` is registered on `runtime.stats`.
- `load()` calls `adaptPixelRatio()` once with a ratio fit to the device: at
  most `1` on desktop and `1.5` on mobile. Ignore it when the user fixed the
  pixel ratio.
- `load()` awaits `loadScene()` for its `scene` option and shows the reported
  `completed`, `total`, and `currentAsset` on the loading screen.
- `runtime.start()` calls `start()` before starting the loop, and
  `runtime.stop()` calls `stop()` before stopping it. The three.js backend
  connects and starts its world and mounts the view helper there.
- `runtime.dispose()` calls `dispose()` last. The backend disposes its world.

## RuntimeWorld

```ts
interface RuntimeWorld {
  readonly animating: boolean;
  readonly input: {
    readonly wasActive: boolean;
    readonly keyboard: MetricsPanelKeyboard;
    readonly gamepad: GamepadPoller;
  };
  readonly assetCoordinator: AssetCoordinator;

  tick(schedule: FrameSchedule): boolean;
  invalidate(): void;
  on(type: "invalidate", handler: () => void): unknown;
  once(type: "afterUpdate", handler: () => void): unknown;
}
```

- `tick()` runs once per scheduled frame. Returning `true` stops the runtime.
- An `invalidate` event wakes a sleeping loop.
- `nextFrame()` resolves on the next `afterUpdate`.
- `animating` and `input.wasActive` keep an on-demand loop awake.
- `load()` loads its `assets` option through `assetCoordinator`.
