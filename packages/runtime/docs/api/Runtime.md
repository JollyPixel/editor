# Runtime

`Runtime` owns browser initialization, engine services, input bindings, and the
game loop. Create it with `Runtime.create()` before calling
[`loadRuntime()`](./loadRuntime.md) or starting it directly.

## API

```ts
type PerformanceStatsPosition = "top-left" | "top-right";

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

  start(): void;
  stop(): void;
  dispose(): void;
}
```

## Construction

The target can be an `HTMLCanvasElement` or a CSS selector. Selector validation
is described in the [runtime canvas reference](./runtime-canvas.md).

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
the first call to `start()` or `loadRuntime()`.

`manager` is the shared Three.js `LoadingManager` used by the default and custom
asset loaders.

`running` reports whether the runtime has been started and has not subsequently
been stopped.

## Lifecycle

`start()` is idempotent. It focuses the canvas, attaches the configured focus
listeners, connects and starts the world, then starts the game loop. Each frame
updates performance statistics when present and calls `world.tick()`.

`stop()` is also idempotent. It stops and disconnects the world, stops the loop,
marks input as exited, and removes the focus listeners.

`dispose()` calls `stop()`, removes the mounted performance HUD, and disposes
the world. Do not reuse the runtime after disposal.

Use [`loadRuntime()`](./loadRuntime.md) for the standard startup sequence.
