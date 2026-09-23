# Runtime

`Runtime` owns browser initialization, engine services, input bindings, and the
game loop. Create it with `Runtime.create()`, then call `runtime.load()` to run
the standard startup sequence.

## API

```ts
type OverlayPosition =
  | "top-left"   | "top-center"    | "top-right"
  | "middle-left"| "center"        | "middle-right"
  | "bottom-left"| "bottom-center" | "bottom-right";
type PerformanceStatsPosition = OverlayPosition;
type FocusHintPosition = OverlayPosition;

interface FocusHintOptions {
  position?: FocusHintPosition;
  inset?: number;
  text?: string;
}

type ViewHelperPosition =
  | "top-left" | "top-right"
  | "bottom-left" | "bottom-right";

interface ViewHelperOptions {
  position?: ViewHelperPosition;
  inset?: number;
}

type RuntimeCanvasTarget = HTMLCanvasElement | string;

interface OverlayLayerOptions {
  container?: HTMLElement | string;
}

interface OverlayMountOptions {
  position?: OverlayPosition;
  inset?: number;
  interactive?: boolean;
}

interface MountedOverlay {
  dispose(): void;
}

class OverlayLayer {
  readonly element: HTMLDivElement;

  mount(content: HTMLElement, options?: OverlayMountOptions): MountedOverlay;
  dispose(): void;
}

interface RuntimeOptions<TContext = Systems.WorldDefaultContext> {
  includePerformanceStats?: boolean | {
    mount?: boolean;
    position?: PerformanceStatsPosition;
    inset?: number;
    panel?: boolean | MetricsPanelOptions;
  };
  focusCanvas?: boolean;
  focusHint?: boolean | FocusHintOptions;
  viewHelper?: boolean | ViewHelperOptions;
  overlay?: OverlayLayerOptions;
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
  readonly overlay: OverlayLayer;
  readonly manager: THREE.LoadingManager;
  readonly running: boolean;
  readonly stats: StatsRecorder;
  readonly metrics: RuntimeMetrics;

  static create<TContext>(
    target: RuntimeCanvasTarget,
    options?: RuntimeOptions<TContext>
  ): Promise<Runtime<TContext>>;

  load(options?: RuntimeLoadOptions<TContext>): Promise<void>;
  nextFrame(): Promise<void>;
  frames(count: number): Promise<void>;
  mountMetricsPanel(options?: MetricsPanelOptions): Promise<MetricsPanel>;
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

The runtime uses the engine's `ThreeRenderer`. Shadows are disabled by default.
When enabled, their default type is `THREE.PCFShadowMap`. Supported types are
`THREE.BasicShadowMap`, `THREE.PCFShadowMap`, and `THREE.VSMShadowMap`.
See the [renderer configuration](../../../engine/docs/systems/renderer.md)
for options.

### Options

| Option | Default | Behavior |
|---|---|---|
| `includePerformanceStats` | `false` | Mounts the corner HUD. `runtime.stats` exists either way. |
| `focusCanvas` | `true` | Restores canvas focus after page clicks while the runtime is running. |
| `focusHint` | `false` | Shows a hint over the canvas while it does not hold keyboard focus. |
| `viewHelper` | `false` | Draws an axis gizmo showing the main camera orientation. See [view helper](#view-helper). |
| `overlay` | Tracks the canvas | Chooses where runtime overlays are mounted. See [overlays](#overlays). |
| `context` | `undefined` | Supplies the world's typed application context. |
| `audio` | Engine default | Supplies the world's global audio service. |
| `assets` | Empty catalog and default loaders | Configures the runtime asset coordinator. |
| `loop` | `GameLoop` defaults | Configures the loop's `FrameScheduler`. |

`runtime.stats` and `runtime.metrics` always exist, and the loop brackets
every frame with them. The option decides what is displayed: `{ mount: false }`
leaves the recorder unmounted, and `{ panel: true }` adds a full readout beside
the corner HUD. The HUD accepts any `OverlayPosition` (default `"top-left"`)
and an `inset` in pixels (default `8`). It is anchored to the canvas through
`runtime.overlay`.

```ts
const runtime = await Runtime.create("canvas", {
  includePerformanceStats: {
    mount: false
  }
});

runtime.stats.begin();
runtime.stats.end();
```

See [frame scheduling and performance](../guides/frame-scheduling-and-performance.md)
for loop, HUD and readout configuration, and [metrics](#metrics) for what the
runtime records.

### Canvas focus hint

The canvas only receives keyboard and mouse input while it holds focus, and
nothing on screen says so. Set `focusHint` to display a translucent
"Click to focus" label over the canvas whenever focus is elsewhere. The hint
hides itself as soon as the canvas is focused again.

```ts
const runtime = await Runtime.create("canvas", {
  focusCanvas: false,
  focusHint: {
    position: "bottom-center",
    inset: 24,
    text: "Cliquez pour prendre le focus"
  }
});
```

| Option | Default | Behavior |
|---|---|---|
| `position` | `"top-center"` | Anchor within the canvas, among the nine listed values. |
| `inset` | `12` | Distance in pixels between the hint and the canvas edges. |
| `text` | `"Click to focus"` | Label displayed inside the hint. |

Passing `true` uses every default. The hint is mounted through
`runtime.overlay`, so it follows the canvas. It never captures pointer events:
a click over the hint reaches the canvas underneath and focuses it. Text wider
than the canvas is truncated with an ellipsis.

Combine it with `focusCanvas: false`. The default `focusCanvas: true` restores
canvas focus after every document click, so the hint would only ever flash.

### View helper

Set `viewHelper` to draw the three.js `ViewHelper` axis gizmo in a corner of
the canvas. It follows the registered camera with the lowest `depth`, re-reading
it every frame, so it picks up cameras created by later scenes and switches when
the main camera changes. Nothing is drawn while no camera is registered.

```ts
const runtime = await Runtime.create("canvas", {
  viewHelper: {
    position: "top-right",
    inset: 8
  }
});
```

| Option | Default | Behavior |
|---|---|---|
| `position` | `"bottom-right"` | Canvas corner the gizmo is drawn in. |
| `inset` | `0` | Distance in pixels between the gizmo and the canvas edges. |

Passing `true` uses every default. The gizmo is 128 pixels square and drawn
into the canvas after each frame, not mounted through `runtime.overlay`. It is
display-only: clicking an axis does not move the camera. It is created on
`start()` and released on `stop()`.

### Overlays

`runtime.overlay` is the layer that holds the performance HUD, the focus hint,
and any element the application mounts over the canvas. It exists as soon as
`Runtime.create()` resolves and is removed by `runtime.dispose()`.

By default the layer is a `position: fixed` element on `document.body` that
copies the canvas bounding box. It updates on window resize, on scroll, and when
the canvas is resized, so it follows a canvas that shrinks when a dock opens.
The layer sets no `z-index`; style `runtime.overlay.element` when the page
stacks positioned elements above the canvas.

Pass `overlay.container` (an element or a CSS selector) to mount the layer
inside that element instead. The layer then fills the container with
`position: absolute` and does no tracking, so the container must be a
positioned element that wraps the canvas. Overlays then stack with the
container's other children.

```ts
const runtime = await Runtime.create("#viewport > canvas", {
  overlay: {
    container: "#viewport"
  },
  includePerformanceStats: {
    position: "top-right"
  }
});
```

`mount()` wraps an element in an anchored slot and returns a handle whose
`dispose()` removes it.

```ts
const badge = document.createElement("span");
badge.textContent = "Offline";

const mounted = runtime.overlay.mount(badge, {
  position: "bottom-right",
  inset: 12
});

mounted.dispose();
```

| Option | Default | Behavior |
|---|---|---|
| `position` | `"top-left"` | Anchor within the layer, among the nine `OverlayPosition` values. |
| `inset` | `8` | Distance in pixels from the anchored edges. The slot is also capped to the layer size minus twice this value. |
| `interactive` | `false` | Lets the element receive pointer events. The layer itself never does. |

## Metrics

`runtime.metrics` is the registry every metric goes through, so one recorder
feeds both the corner HUD and the readout panel.

```ts
class RuntimeMetrics {
  readonly recorder: StatsRecorder;
  readonly revision: number;
  readonly panel: MetricsPanel | null;

  addMetric(definition: MetricDefinition): () => void;
  addSource(source: MetricSource): () => void;
  removeMetric(id: string): boolean;
  track(id: string, value: number): void;
}
```

A subsystem describing metrics hands them over as a source, and gets back a
function releasing them again.

```ts
const release = runtime.metrics.addSource(engine.inspector);
```

The source is anything carrying a `metrics` array, matched structurally, so a
package need not depend on `@jolly-pixel/ui` to describe what it counts. See
[`MetricSource`](../../../ui/docs/api/stats/metric-definition.md#describing-metrics-from-another-package).

Hold the returned function whenever the source dies before the runtime does. A
metric left behind keeps sampling a disposed subsystem through its `sample()`
closure.

The runtime registers the `WebGPURenderer` counters itself, under the
`renderer` group: `calls`, `renderedTriangles`, `geometries` and `textures`.
It latches the render counters on every `draw`, which the renderer otherwise
resets between frames.

### The readout panel

`mountMetricsPanel()` builds a full readout from the metric definitions: one
folder per group, one row per metric, labelled and formatted as its definition
describes. Metrics registered later join it on their own.

```ts
interface MetricsPanelOptions {
  target?: HTMLElement | FacadeContainer;
  floating?: boolean;
  key?: string;
  title?: string;
  storageKey?: string;
  toggleKey?: string;
  keyboard?: MetricsPanelKeyboard;
  hidden?: boolean;
  collapsible?: boolean;
}
```

| Option | Default | Behavior |
|---|---|---|
| `target` | floats | An `HTMLElement` receives a pane of its own; a `FacadeContainer` takes the folders directly, merging the readout into a pane the caller owns. |
| `floating` | `false` | Floats the pane inside the target rather than appending it. Targeting a `jolly-dock-layout` this way lets the window be docked into its groups. |
| `key` | derived | Identity the pane persists and docks under. |
| `title` | `"Performance"` | Heading of the pane the panel creates. Unused with a `FacadeContainer`. |
| `storageKey` | derived | Namespace the pane persists under. |
| `toggleKey` | none | `KeyboardEvent.code` toggling the readout, through the runtime's keyboard. |
| `hidden` | `false` | Starts the readout hidden. |
| `collapsible` | `true` | Enables folding the created pane to its header. |

```ts
const panel = await runtime.mountMetricsPanel({
  target: inspectorPane,
  toggleKey: "F3"
});

panel.container.addFolder({ title: "inspector" });
```

`panel.container` is the container the rows were added to, so a consumer adds
controls of its own beside them. Mounting a second panel disposes the first.

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

The focus hint, when enabled, is mounted by `start()` and removed by `stop()`.

`dispose()` calls `stop()`, removes the mounted performance HUD and readout, and disposes
the world. Do not reuse the runtime after disposal.

## Frame stepping

`nextFrame()` resolves after the next rendered frame: the world has updated
and drawn, and emitted `afterUpdate`. Fixed steps without a render do not count.
`frames(count)` resolves after `count` rendered frames, at once when `count` is
zero or less. Neither resolves while the runtime is stopped.

```ts
camera.position.set(0, 10, 10);
await runtime.frames(2);
```
