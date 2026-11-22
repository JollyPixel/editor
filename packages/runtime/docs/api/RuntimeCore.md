# RuntimeCore

`RuntimeCore` drives a `RuntimeBackend` for one canvas: game loop, session,
overlay, loading screen, and metrics. It imports no renderer and no ECS: the
backend brings the world. `@jolly-pixel/backend.three` builds its three.js
`Runtime` on it.

```ts
import { RuntimeCore } from "@jolly-pixel/runtime";

const runtime = new RuntimeCore(canvas, backend, {
  renderOnDemand: true
});
await runtime.load({ scene: level });
```

How the parts fit together is in [ARCHITECTURE.md](../../ARCHITECTURE.md).

## new RuntimeCore(canvas, backend, options?)

```ts
interface RuntimeCoreOptions {
  /** Refocuses the canvas after any click in the page. @default true */
  focusCanvas?: boolean;
  /**
   * Shows a hint while the canvas has no focus. Pair it with
   * `focusCanvas: false`, or the hint only flashes.
   * @default false
   */
  focusHint?: boolean | FocusHintOptions;
  /** Element or selector hosting `runtime.overlay`. @default tracks the canvas */
  overlay?: { container?: HTMLElement | string; };
  /** Scheduler options of `runtime.loop`, plus its `idleDelay` (2000 by default). */
  loop?: FrameSchedulerOptions & { idleDelay?: number; };
  /** Stops rendering while nothing changes. @default false */
  renderOnDemand?: boolean;
  /** Stops the loop while the canvas is off screen or inside a hidden frame. @default false */
  suspendWhenHidden?: boolean;
  /** Receives the startup steps. @default a logger that records nothing */
  logger?: RuntimeLogger;
}

interface FocusHintOptions {
  position?: OverlayPosition; // "top-center"
  inset?: number; // 12, pixels from the canvas edges
  text?: string; // "Click to focus"
}

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

Nothing runs until `load()` or `start()`.

## Properties

```ts
interface RuntimeCore<TWorld, TScene, TMetrics> {
  /** The backend's world, also assigned to `globalThis.game` for the devtools console. */
  readonly world: TWorld;
  /** Configure its scheduler before `start()` or `load()`. */
  readonly loop: GameLoop;
  readonly canvas: HTMLCanvasElement;
  /** HTML layer above the canvas. */
  readonly overlay: OverlayLayer;
  /** Times every frame, with or without a HUD. */
  readonly stats: StatsRecorder;
  /** Metric registry and readout panel. */
  readonly metrics: RuntimeMetrics<TMetrics>;
  /** The corner HUD, or `null` when none is mounted. Set its `hidden` to hide it without unmounting. */
  readonly statsHud: PerformanceStatsHud | null;
  /** `true` between `start()` and `stop()`. */
  readonly running: boolean;
  readonly renderOnDemand: boolean;
  /** `true` while on-demand rendering sleeps. */
  readonly idle: boolean;
}
```

See [`OverlayLayer`](./OverlayLayer.md) and [`RuntimeMetrics`](./RuntimeMetrics.md).

## Methods

### load(options?): Promise\<void\>

Runs startup, then `start()`. See [loading and startup](#loading-and-startup).

### start(): void

Attaches the focus listener and focus hint, calls the backend's `start()`,
and starts the loop. Idempotent.

### stop(): void

Reverses `start()`. Idempotent, and called when a world tick requests an exit.

### dispose(): void

Stops, then removes the HUD, readout panel, and overlay layer and disposes the
backend. Do not reuse the runtime.

### nextFrame(): Promise\<void\>

Requests a frame and resolves once a frame has rendered and emitted
`afterUpdate`. Never resolves while stopped.

### frames(count): Promise\<void\>

Awaits `nextFrame()` `count` times.

### mountPerformanceStats(option?): Promise\<PerformanceStatsHud | null\>

Mounts the corner HUD and disposes the previous one. Resolves to the HUD, or
`null` with `mount: false`.

```ts
type PerformanceStatsOption = true | {
  mount?: boolean; // true
  position?: OverlayPosition; // "top-left"
  inset?: number; // 8, pixels from the canvas edges
  panel?: boolean | MetricsPanelOptions; // false; also mounts the readout panel
};
```

### mountMetricsPanel(options?): Promise\<MetricsPanel\>

`metrics.mountPanel()` with the world keyboard as `keyboard`.

## Loading and startup

`load()` configures the device, loads startup assets and the initial scene
behind a loading screen, then calls `start()`. The step order is in
[ARCHITECTURE.md](../../ARCHITECTURE.md#startup).

```ts
interface RuntimeCoreLoadOptions<TScene> {
  /** Initial scene, loaded through the backend before the runtime starts. */
  scene?: TScene;
  /** Extra asset references, loaded before the scene. */
  assets?: Iterable<AssetReference<unknown>>;
  /** Render cap. Skips GPU benchmarking; `Infinity` removes the cap. @default GPU estimate */
  maxFps?: number;
  /** Shows the canvas at once and ignores the two options below. @default false */
  skipLoadingScreen?: boolean;
  /** Minimum milliseconds the screen shows before assets load. @default 850 */
  loadingDelay?: number;
  /** Parent of the loading screen. @default document.body */
  loadingContainer?: HTMLElement;
}
```

A failing step rejects with its `Error`, which the loading screen also
displays. The runtime stays stopped.

## Rendering on demand

With `renderOnDemand: true`, the loop sleeps once no frame is owed and
`loop.idleDelay` milliseconds have passed since the last frame request. While
started, the runtime requests frames on:

- keyboard, pointer, wheel, and drag-and-drop events in the page;
- window `resize`, `focus`, and `blur`;
- a resize of the canvas container or a device pixel ratio change;
- a `gamepadconnected` event, or a held button or stick on a connected
  gamepad, sampled once per animation frame while idle without rendering;
- every frame after which `world.animating` or `world.input.wasActive` is
  `true`;
- every `invalidate` event of the world.

The HUD shows an `IDLE` badge while `idle` is `true`. The runtime calls
`stats.skipGap()` whenever the loop starts or wakes, so the idle time never
shows up as an FPS drop.

## Startup tracing

`logger.step()` records the `device` and `assets` steps of `load()`, and
`scene` when a scene is given. Once started, an enabled logger writes
`waiting for first frame` with `visibility` (`document.visibilityState`), then
`first frame`. A missing `first frame` next to `visibility: "hidden"`
explains a scene that never woke.

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
  most `2` on desktop and `1.5` on mobile. Ignore it when the user fixed the
  pixel ratio.
- `load()` awaits `loadScene()` for its `scene` option and shows the reported
  `completed`, `total`, and `currentAsset` on the loading screen.
- `runtime.start()` calls `start()` before starting the loop, and
  `runtime.stop()` calls `stop()` before stopping it.
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

## Helpers for backends

A backend subclass calls these protected statics from its own factory, before
it builds its renderer.

### RuntimeCore.resolveCanvas(target): HTMLCanvasElement

Returns `target` when it is a canvas, or the canvas a CSS selector matches.
Throws when the selector matches nothing, and a `TypeError` when the element
is not a canvas.

### RuntimeCore.resolveCatalog(input?): Promise\<AssetCatalog\>

Returns an `AssetCatalog` as is, an empty one when `input` is omitted, and
fetches and parses a string or `URL`. Rejects when the response is not ok.
