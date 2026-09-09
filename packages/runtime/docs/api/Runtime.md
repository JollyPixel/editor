# Runtime

`Runtime` owns browser initialization, engine services, input bindings, and the
game loop. Create it with `Runtime.create()`, then call `runtime.load()` to run
the standard startup sequence.

## API

```ts
type PerformanceStatsPosition = "top-left" | "top-right";
type RuntimeCanvasTarget = HTMLCanvasElement | string;

interface RuntimeOptions<TContext = Systems.WorldDefaultContext> {
  includePerformanceStats?: boolean | {
    mount?: boolean;
    position?: PerformanceStatsPosition;
  };
  focusCanvas?: boolean;
  context?: TContext;
  audio?: GlobalAudio;
  assets?: RuntimeAssetOptions;
  loop?: FrameSchedulerOptions;
}

interface RuntimeLoadOptions<
  TContext = Systems.WorldDefaultContext
> {
  loadingDelay?: number;
  loadingContainer?: HTMLElement;
  assets?: Iterable<AssetReference<unknown>>;
  scene?: Systems.Scene<TContext>;
  skipLoadingScreen?: boolean;
  maxFps?: number;
}

class Runtime<TContext = Systems.WorldDefaultContext> {
  readonly world: Systems.World<THREE.WebGPURenderer, TContext>;
  readonly loop: GameLoop;
  readonly canvas: HTMLCanvasElement;
  readonly manager: THREE.LoadingManager;
  readonly running: boolean;
  stats?: StatsRecorder;

  static create<TContext>(
    target: RuntimeCanvasTarget,
    options?: RuntimeOptions<TContext>
  ): Promise<Runtime<TContext>>;

  load(options?: RuntimeLoadOptions<TContext>): Promise<void>;
  start(): void;
  stop(): void;
  dispose(): void;
}
```

## Construction

The target can be an `HTMLCanvasElement` or a CSS selector. Passing a canvas
uses that element directly. A selector is resolved with
`document.querySelector()`.

```ts
const runtime = await Runtime.create("canvas", {
  context: {
    difficulty: "normal"
  },
  assets: {
    catalog: new URL("assets.json", document.baseURI)
  }
});
```

`Runtime.create()` resolves the asset configuration before constructing the
renderer and world. It rejects when the canvas target or asset catalog is
invalid, when the catalog request fails, or when renderer initialization fails.
It also rejects when the selector matches no element or a non-canvas element.

### Options

| Option | Default | Behavior |
|---|---|---|
| `includePerformanceStats` | `false` | Creates a `StatsRecorder`. `true` also mounts the default HUD. |
| `focusCanvas` | `true` | Restores canvas focus after page clicks while the runtime is running. |
| `context` | `undefined` | Supplies the world's typed application context. |
| `audio` | Engine default | Supplies the world's global audio service. |
| `assets` | Empty catalog and default loaders | Configures the runtime asset coordinator. |
| `loop` | `GameLoop` defaults | Configures the loop's `FrameScheduler`. |

Pass `{ mount: false }` to create `runtime.stats` without mounting the default
HUD. The mounted HUD supports `"top-left"` and `"top-right"`; its default is
`"top-left"`.

```ts
const runtime = await Runtime.create("canvas", {
  includePerformanceStats: {
    mount: false
  }
});

runtime.stats?.begin();
// Measure custom work.
runtime.stats?.end();
```

See [frame scheduling and performance](../guides/frame-scheduling-and-performance.md)
for loop and HUD configuration.

## Services

`world` exposes the renderer, input, scene manager, audio service, application
context, and asset coordinator. The runtime installs its scene loader on the
world's `SceneManager` during construction.

`loop` exists as soon as construction completes. Configure its scheduler before
the first call to `start()` or `load()`.

`manager` is the shared Three.js `LoadingManager` used by the default and custom
asset loaders.

`running` reports whether the runtime has been started and has not subsequently
been stopped.

## Loading and startup

`load()` configures the device, prepares startup assets and an optional initial
scene, then starts the runtime.

| Option | Default | Behavior |
|---|---|---|
| `loadingDelay` | `850` | Minimum time in milliseconds before asset loading begins. |
| `loadingContainer` | `document.body` | Element that contains the loading screen. |
| `assets` | Empty iterable | Additional references loaded before the initial scene. |
| `scene` | `undefined` | Initial scene prepared and queued before the runtime starts. |
| `skipLoadingScreen` | `false` | Starts without mounting or updating a loading screen. |
| `maxFps` | GPU estimate or `Infinity` | Overrides the render cap chosen during device setup. |

```ts
await runtime.load({
  assets: [sharedUiReference],
  scene: new GameScene(),
  maxFps: 144
});
```

With the loading screen enabled, its entrance animation, GPU detection, and
minimum delay run concurrently. Additional assets load next, followed by the
initial scene. The screen completes before the runtime starts.

`loadingDelay` controls the first phase only. Asset and scene loading can keep
the screen visible for longer.

When `skipLoadingScreen` is `true`, the canvas is shown immediately. Device
configuration, additional assets, and the initial scene run in that order;
`loadingDelay` and `loadingContainer` are ignored.

The returned promise resolves after `start()` has been called. Once the loading
screen has mounted, device, asset, and scene failures are displayed on the
screen and the promise rejects with the same `Error`. A loading-screen mount
failure rejects directly. With the screen skipped, startup errors also reject
directly. The runtime remains stopped when startup fails.

See [customizing the loading screen](../guides/loading-screen.md) for container,
theme, and opt-out examples.

## Lifecycle

`start()` is idempotent. It focuses the canvas, attaches the configured focus
listeners, connects and starts the world, then starts the game loop. Each frame
updates performance statistics when present and calls `world.tick()`.

`stop()` is also idempotent. It stops and disconnects the world, stops the loop,
marks input as exited, and removes the focus listeners.

`dispose()` calls `stop()`, removes the mounted performance HUD, and disposes
the world. Do not reuse the runtime after disposal.
