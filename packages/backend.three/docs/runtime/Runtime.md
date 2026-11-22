# Runtime

`Runtime` creates the renderer, world, and game loop for one canvas, then
drives them. It extends `RuntimeCore` of `@jolly-pixel/runtime`, which owns
the loop, session, overlay, loading screen, metrics, `load()`, `start()`,
`stop()` and rendering on demand. This page lists what the three.js runtime
adds.

```ts
import { Runtime } from "@jolly-pixel/backend.three";

const runtime = await Runtime.create("canvas", {
  assets: {
    catalog: new URL("assets.json", document.baseURI)
  }
});

await runtime.load({
  scene: new GameScene()
});
```

## Runtime.create(target, options?)

`target` is an `HTMLCanvasElement` or a CSS selector. The promise rejects when
the selector matches nothing or a non-canvas element, when the
[asset catalog](./runtime-assets.md) cannot be resolved, or when the renderer
fails to initialize. The catalog resolves first, so a failed request rejects
before any renderer exists.

`options` takes every `RuntimeCoreOptions` field, plus:

```ts
interface RuntimeOptions<TContext> {
  /** Typed application context of the world. */
  context?: TContext;
  /** Catalog and extra loaders. @default empty catalog */
  assets?: RuntimeAssetOptions;
  /** Global audio service of the world. @default a new GlobalAudio */
  audio?: GlobalAudio;
  /**
   * Forwarded to `ThreeRenderer.create()`. An explicit `output.pixelRatio`
   * or `output.maxPixelRatio` survives `load()`.
   */
  renderer?: ThreeRendererOptions;
  /** Startup steps, a lost GPU device, and `world.logger`. @default a logger that writes warnings and errors */
  logger?: Systems.Logger;
  /** `true` or an object mounts the corner HUD. @default false */
  includePerformanceStats?: false | PerformanceStatsOption;
  /**
   * `true` or an object draws a 128 px axis gizmo for the camera with the
   * lowest `depth`. Display only.
   * @default false
   */
  viewHelper?: boolean | {
    position?: "top-left" | "top-right" | "bottom-left" | "bottom-right"; // "bottom-right"
    inset?: number; // 0, pixels from the canvas edges
  };
}
```

See [`ThreeRenderer`](../systems/renderer.md) for the renderer options and
[asset options](./runtime-assets.md) for `assets`.

## Properties

```ts
interface Runtime<TContext> {
  readonly world: Systems.World<THREE.WebGPURenderer, TContext>;
  /** Same object as `world.renderer`, with its concrete type. */
  readonly renderer: ThreeRenderer;
  /** Shared by every asset loader. */
  readonly manager: THREE.LoadingManager;
  /**
   * The axis gizmo's resolved `position` and `inset`, or `null` without the
   * `viewHelper` option. Setting its `hidden` requests a frame and lasts
   * across `stop()` and `start()`.
   */
  readonly viewHelper: ViewHelperSettings | null;
}
```

`runtime.metrics.renderer` holds the [renderer counters](./RendererMetrics.md).

## Methods

### compiledFrame(): Promise\<void\>

Awaits `nextFrame()`, then, while the renderer has
[pipelines compiling](../systems/renderer.md#pipeline-compiles), waits for
them and awaits another frame. Resolves once a frame has drawn every object.
Never resolves while stopped.

## Loading and startup

`load()` comes from `RuntimeCore`. Its `scene` is a `Systems.Scene`; the
runtime awaits its `SceneLoad.done` and shows its progress on the loading
screen. A ready scene becomes active on the next frame, so `load()` resolves
before the scene's `awake()` runs. The screen is covered by the
[loading screen guide](../guides/loading-screen.md).

`start()` also mounts the view helper, then connects and starts the world;
`stop()` reverses it.

## Rendering on demand

On top of the `RuntimeCore` wake-ups, the renderer's `compiled` event requests
a frame, so objects skipped while their pipelines compiled get drawn. A
`world.keepAlive()` predicate that returns `true` keeps the loop awake, and
any other change to what is drawn must call `world.invalidate()`.

## Startup tracing

`logger` records each step as a `Logger.step`: `<step> started`, then
`<step> done` with `ms` or `<step> failed` with `error`, on the logger's own
namespace. `create()` adds the `catalog` and `renderer` steps, and `stats`
with `includePerformanceStats`, before the `RuntimeCore` steps of `load()`.

When the renderer emits [`deviceLost`](../systems/renderer.md#events), the
logger writes an error with `api`, `message` and `reason`. The canvas stays
blank until the page reloads.

The world logs through the same logger, so one `listener` or one set of
`namespaces` covers the startup steps, the world, its scenes and their
components. The backend adds `three.scene-environment` (an unavailable room
environment) and `three.sprite-renderer` (a missing sprite animation).
