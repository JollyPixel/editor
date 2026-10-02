# RuntimeMetrics

`runtime.metrics` registers metrics on `runtime.stats`, the one recorder behind
the corner HUD and the readout panel. Setup recipes are in
[frame scheduling and performance](../guides/frame-scheduling-and-performance.md).

```ts
const release = runtime.metrics.addSource(engine.inspector);
```

## Properties

| Property | Type | Description |
|---|---|---|
| `renderer` | `RendererMetrics` | The [renderer counters](#renderer-counters). |
| `panel` | `MetricsPanel \| null` | The mounted [readout panel](#metricspanel). |

## Methods

| Method | Description |
|---|---|
| `addSource(source)` | Registers every metric of a [`MetricSource`](../../../ui/docs/api/stats/metric-definition.md#describing-metrics-from-another-package) and returns a release function. Call it when the source dies before the runtime; a leftover metric keeps sampling it. |
| `addMetric(definition)` | Registers one [`MetricDefinition`](../../../ui/docs/api/stats/metric-definition.md) and returns a release function. |
| `removeMetric(id)` | Removes a metric. Returns `false` when the id is unknown. |
| `track(id, value)` | Pushes a value to a metric, as [`StatsRecorder.track()`](../../../ui/docs/api/stats/stats-recorder.md#push-a-custom-metric). |
| `mountPanel(options?)` | Mounts the readout panel and disposes the previous one. `runtime.mountMetricsPanel()` adds the world keyboard. |
| `dispose()` | Called by `runtime.dispose()`. |

## Renderer counters

The runtime registers the `WebGPURenderer` counters under the `renderer` group,
outside the HUD cycle: `calls`, `renderedTriangles`, `geometries`, `textures`,
and the byte counts `geometryMemory` and `textureMemory`.

Three.js resets `renderer.info.render` on every animation-loop tick, including
the ticks the `maxFps` cap skips, so a read outside a `"draw"` handler mostly
sees zero. Read `renderer.frame` instead:

```ts
const { drawCalls, triangles } = runtime.metrics.renderer.frame;
```

It returns a new `RendererFrameStats` on every read. `drawCalls` and
`triangles` come from the last drawn frame; `geometries` and `textures` are
live. To refresh a display at the recorder's pace, read it from
[`runtime.stats.subscribe()`](../../../ui/docs/api/stats/stats-recorder.md#subscribe-to-refreshes).

## MetricsPanel

The readout lists one folder per metric `group` and one row per metric.
Metrics registered later join it on their own.

| Member | Description |
|---|---|
| `container` | `FacadeContainer` holding the rows. Add your own controls to it. |
| `hidden` | Shows or hides the readout. |
| `dispose()` | Removes the readout. |

### MetricsPanelOptions

| Option | Default | Description |
|---|---|---|
| `target` | floats over the page | An `HTMLElement` receives a pane of its own; a `FacadeContainer` takes the folders directly. |
| `floating` | `false` | Floats the pane inside an `HTMLElement` target. Target a `jolly-dock-layout` to make it dockable. |
| `key` | none | Identity the pane persists and docks under. Required to dock. |
| `title` | `"Performance"` | Pane heading. Unused with a `FacadeContainer`. |
| `storageKey` | none | Namespace the pane persists under. |
| `toggleKey` | none | `KeyboardEvent.code` toggling `hidden`, read from `keyboard`. |
| `keyboard` | world keyboard, through `runtime.mountMetricsPanel()` | Emits the `toggleKey` events. |
| `hidden` | `false` | Starts hidden. |
| `collapsible` | `true` | Lets the created pane fold to its header. |
| `filter` | none | Keeps only the metrics it accepts, later ones included. `(metric) => metric.tile === false` drops what the HUD already cycles. |
