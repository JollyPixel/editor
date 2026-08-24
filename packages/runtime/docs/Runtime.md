# Runtime

`Runtime` owns browser initialization, platform asset loaders, input bindings,
and the engine loop. It installs an internal scene loader into `SceneManager`,
so gameplay code requests scenes through the engine.

## Construction

```ts
interface RuntimeAssetOptions {
  readonly catalog?: AssetCatalog | string | URL;
  readonly loaders?: Iterable<RuntimeAssetLoaderDefinition<unknown>>;
}

interface RuntimeAssetLoaderDefinition<TValue = unknown> {
  readonly type: AssetType<TValue>;

  create(
    manager: THREE.LoadingManager
  ): AssetLoader<TValue>;
}

interface RuntimeOptions<TContext = Systems.WorldDefaultContext> {
  includePerformanceStats?: boolean | {
    mount?: boolean;
    position?: "top-left" | "top-right";
  };
  focusCanvas?: boolean;
  context?: TContext;
  audio?: GlobalAudio;
  assets?: RuntimeAssetOptions;
  loop?: FrameSchedulerOptions;
}

const runtime = await Runtime.create(canvas, {
  assets: {
    catalog: "/assets.json"
  }
});
```

Place a persistent catalog in the Vite project's `public/` directory to serve
it unchanged in development and copy it to the build output:

```json
{
  "version": 1,
  "assets": [
    {
      "id": "hero-model",
      "kind": "model",
      "source": "models/hero.glb"
    }
  ]
}
```

Set `includePerformanceStats` to `true` to mount a themeable performance HUD at
the top-left corner. Pass `{ mount: false }` to create the same public
`runtime.stats` recorder without mounting a display, for custom placement.
Use `{ position: "top-right" }` to anchor the default display to the other top
corner; it follows viewport resizes.

`Runtime.create()` fetches string and `URL` inputs, parses the response through
`AssetCatalog.parse()`, then constructs the world. An unsuccessful response,
invalid JSON, or invalid manifest rejects the returned promise. Passing an
`AssetCatalog` keeps the existing programmatic option.

Runtime always registers the engine model, font, and audio loaders. Additional
definitions receive the same Three.js loading manager and are added to the
internal registry:

```ts
const runtime = await Runtime.create(canvas, {
  assets: {
    catalog: "/assets.json",
    loaders: [
      {
        type: TILE_MAP_ASSET,
        create: (manager) => new TileMapAssetLoader(manager)
      }
    ]
  }
});
```

Projects do not need to create or manage an `AssetLoaderRegistry`. A custom
definition that duplicates a default asset kind throws during construction.

`focusCanvas` defaults to `true`. While the runtime is running, page clicks
restore focus to the canvas and canvas keypress defaults are prevented. The
listeners are removed by `stop()` and installed again by `start()`.

## Scene loading

Gameplay code requests scenes from `SceneManager`:

```ts
const load = runtime.world.sceneManager.loadScene(
  new BattleScene(),
  {
    activation: "manual"
  }
);
```

The runtime prepares `scene.assets` in the background and reports progress to
the returned `SceneLoad`. Calling `load.allowActivation()` tells the load to
release a ready scene and schedule its replacement at the next frame boundary.
The engine [SceneManager documentation](../../engine/docs/systems/scene-manager.md)
includes the state model and a transition example.

## Explicit asset batches

Code outside the ECS lifecycle can start an independent batch through the
world's coordinator:

```ts
const batch = runtime.world.assetCoordinator.loadBatch([iconReference], {
  onProgress(progress) {
    console.log(progress.completed, progress.total);
  }
});

await batch.done;
```

Each batch owns its totals, failures, status, and completion promise.

## API

```ts
class Runtime<TContext = Systems.WorldDefaultContext> {
  world: Systems.World<THREE.WebGPURenderer, TContext>;
  readonly loop: GameLoop;
  canvas: HTMLCanvasElement;
  stats?: Stats;

  static create<TContext>(
    canvas: HTMLCanvasElement,
    options?: RuntimeOptions<TContext>
  ): Promise<Runtime<TContext>>;

  start(): void;
  stop(): void;
  dispose(): void;
}
```

### `loop`

The [`GameLoop`](../../loop/docs/gameloop.md) owns the runtime's frame source and
its single `FrameScheduler`. It controls the start/stop lifecycle and calls
`world.tick(schedule)` once per frame. The loop exists from construction.
Configure its scheduler before the first frame:

```ts
runtime.loop.scheduler.fixedFps = 60;  // simulation rate
runtime.loop.scheduler.maxFps = 144;   // render cap, independent of fixedFps
runtime.loop.timeScale = 0.5;          // slow motion; 0 pauses the simulation
```

Set `timeScale` on the loop. When paused, the loop writes zero to the scheduler
while retaining the requested scale. Use `runtime.start()` and `runtime.stop()`
to drive the loop.

## Bootstrap loading screen

`loadRuntime()` accepts an initial scene and additional references. It reports
both operations through the loading screen before starting the loop:

```ts
await loadRuntime(runtime, {
  scene: new BattleScene(),
  assets: [sharedUiReference]
});
```

GPU detection and the minimum loading delay run concurrently. If device setup
or asset loading fails, the loading screen displays the error and
`loadRuntime()` rejects with that error.

Pass `skipLoadingScreen: true` to bypass the loading screen entirely: no
overlay is mounted, the canvas is shown immediately, and `loadingDelay` /
`loadingContainer` are ignored.

```ts
await loadRuntime(runtime, {
  scene: new BattleScene(),
  skipLoadingScreen: true
});
```
