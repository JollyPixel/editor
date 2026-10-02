# Runtime

`Runtime` creates the renderer, world, and game loop for one canvas, then
drives them. How the parts fit together is in
[ARCHITECTURE.md](../../ARCHITECTURE.md).

```ts
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
fails to initialize.

### Options

| Option | Default | Description |
|---|---|---|
| `context` | `undefined` | Typed application context of the world. |
| `assets` | empty catalog | Catalog and extra loaders. See [asset options](./runtime-assets.md). |
| `audio` | engine default | Global audio service of the world. |
| `renderer` | engine defaults | Forwarded to [`ThreeRenderer.create()`](../../../engine/docs/systems/renderer.md). An explicit `output.pixelRatio` or `output.maxPixelRatio` survives `load()`. |
| `loop` | scheduler defaults | [`FrameSchedulerOptions`](../../../loop/docs/framescheduler.md) of `runtime.loop`. |
| `logger` | every namespace disabled | Receives the [startup steps](#startup-tracing). |
| `overlay.container` | tracks the canvas | Element or selector hosting [`runtime.overlay`](./OverlayLayer.md). |
| `includePerformanceStats` | `false` | `true` or an object mounts the corner HUD. |
| `includePerformanceStats.mount` | `true` | `false` leaves the HUD unmounted. |
| `includePerformanceStats.position` | `"top-left"` | [`OverlayPosition`](./OverlayLayer.md#overlayposition) of the HUD. |
| `includePerformanceStats.inset` | `8` | Distance in pixels from the canvas edges. |
| `includePerformanceStats.panel` | `false` | `true` or [`MetricsPanelOptions`](./RuntimeMetrics.md#metricspaneloptions) also mounts the readout panel. |
| `focusCanvas` | `true` | Refocuses the canvas after any click in the page. |
| `focusHint` | `false` | `true` or an object shows a hint while the canvas has no focus. Pair it with `focusCanvas: false`, or the hint only flashes. |
| `focusHint.position` | `"top-center"` | [`OverlayPosition`](./OverlayLayer.md#overlayposition) of the hint. |
| `focusHint.inset` | `12` | Distance in pixels from the canvas edges. |
| `focusHint.text` | `"Click to focus"` | Label of the hint. |
| `viewHelper` | `false` | `true` or an object draws a 128 px axis gizmo for the camera with the lowest `depth`. Display only. |
| `viewHelper.position` | `"bottom-right"` | `"top-left"`, `"top-right"`, `"bottom-left"` or `"bottom-right"`. |
| `viewHelper.inset` | `0` | Distance in pixels from the canvas edges. |
| `renderOnDemand` | `false` | Stops rendering while nothing changes. See [rendering on demand](#rendering-on-demand). |
| `suspendWhenHidden` | `false` | Stops the loop while the canvas is off screen or inside a hidden frame. See [`suspendWhenHidden`](../../../loop/docs/gameloop.md#suspendwhenhidden). |

## Properties

| Property | Type | Description |
|---|---|---|
| `world` | `World<WebGPURenderer, TContext>` | Scene manager, input, audio, context, and asset coordinator. |
| `renderer` | `ThreeRenderer` | Same object as `world.renderer`, with its concrete type. |
| `loop` | `GameLoop` | Configure its scheduler before `start()` or `load()`. |
| `canvas` | `HTMLCanvasElement` | The resolved target. |
| `overlay` | [`OverlayLayer`](./OverlayLayer.md) | HTML layer above the canvas. |
| `manager` | `THREE.LoadingManager` | Shared by every asset loader. |
| `stats` | [`StatsRecorder`](../../../ui/docs/api/stats/stats-recorder.md) | Times every frame, with or without a HUD. |
| `metrics` | [`RuntimeMetrics`](./RuntimeMetrics.md) | Metric registry and readout panel. |
| `running` | `boolean` | `true` between `start()` and `stop()`. |
| `renderOnDemand` | `boolean` | The option's value. |
| `idle` | `boolean` | `true` while on-demand rendering sleeps. |

## Methods

| Method | Description |
|---|---|
| `load(options?)` | Runs startup, then `start()`. See [loading and startup](#loading-and-startup). |
| `start()` | Attaches the focus listener, focus hint, and view helper, connects the world, and starts the loop. Idempotent. |
| `stop()` | Reverses `start()`. Idempotent, and called when input requests an exit. |
| `dispose()` | Stops, then removes the HUD, readout panel, and overlay layer and disposes the world. Do not reuse the runtime. |
| `nextFrame()` | Requests a frame and resolves once a frame has rendered and emitted `afterUpdate`. Never resolves while stopped. |
| `frames(count)` | Awaits `nextFrame()` `count` times. |
| `mountMetricsPanel(options?)` | `metrics.mountPanel()` with the world keyboard as `keyboard`. |

## Loading and startup

`load()` configures the device, loads startup assets and the initial scene
behind a loading screen, then calls `start()`. The step order is in
[ARCHITECTURE.md](../../ARCHITECTURE.md#startup) and the screen is covered by
the [loading screen guide](../guides/loading-screen.md).

| Option | Default | Description |
|---|---|---|
| `scene` | `undefined` | Initial scene, loaded before the runtime starts. It awakes on the first frame, after `load()` resolves. |
| `assets` | none | Extra asset references, loaded before the scene. |
| `maxFps` | GPU estimate | Render cap. Skips GPU benchmarking; `Infinity` removes the cap. |
| `skipLoadingScreen` | `false` | Shows the canvas at once and ignores the two options below. |
| `loadingDelay` | `850` | Minimum milliseconds the screen shows before assets load. |
| `loadingContainer` | `document.body` | Parent of the loading screen. |

A failing step rejects with its `Error`, which the loading screen also
displays. The runtime stays stopped.

## Rendering on demand

With `renderOnDemand: true`, the loop sleeps once no frame is owed. The
[`GameLoop`](../../../loop/docs/gameloop.md#rendering-on-demand) page explains
the trailing frames and wake-up delta. While started, the runtime requests
frames on:

- keyboard, pointer, wheel, and drag-and-drop events in the page;
- window `resize`, `focus`, and `blur`;
- a resize of the canvas container or a device pixel ratio change;
- every frame after which a key, button, or touch is still held, or a
  [`world.keepAlive()`](../../../engine/docs/systems/world.md#rendering-on-demand)
  predicate returns `true`.

Any other change to what is drawn must call
[`world.invalidate()`](../../../engine/docs/systems/world.md#rendering-on-demand).
Gamepads are polled, so their first press after going idle is missed. The HUD
shows an `IDLE` badge while `idle` is `true`.

## Startup tracing

`logger` records each step as a
[`Logger.step`](../../../engine/docs/systems/logger.md#steps): `<step> started`,
then `<step> done` with `ms` or `<step> failed` with `error`, on the logger's own
namespace.

| Step | Logged by |
|---|---|
| `catalog` | `create()` |
| `renderer` | `create()` |
| `stats` | `create()`, with `includePerformanceStats` |
| `device` | `load()` |
| `assets` | `load()` |
| `scene` | `load()`, with `scene`; meta `scene` holds its name |

Once started, an enabled logger writes `waiting for first frame` with
`visibility` (`document.visibilityState`), then `first frame`. A missing
`first frame` next to `visibility: "hidden"` explains a scene that never woke.
