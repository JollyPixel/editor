# Stats

`StatsRecorder` separates performance measurement from its display. Import it from the DOM-free
`@jolly-pixel/ui/stats` subpath in runtimes, workers, benchmarks, or browser code. Importing that
subpath does not load Lit or register custom elements.

```ts
import { StatsRecorder } from "@jolly-pixel/ui/stats";

const recorder = new StatsRecorder();

recorder.begin();
world.tick();
recorder.end();
```

The recorder publishes one snapshot every 250 milliseconds and retains the latest 60 snapshots
for each metric. `begin()` and `end()` produce the built-in `fps`, average `ms`, and `worstMs`
metrics. Chromium's non-standard `performance.memory` adds `mb` when available and scales its
graph against `jsHeapSizeLimit`. FPS uses a stable 0-100 graph range; MS and WORST MS use 0-200
milliseconds so timing spikes entering or leaving history do not rescale the graph. Built-ins are
always registered and cannot be disabled.

## Custom metrics

Every metric uses the same public contract:

```ts
interface MetricDefinition {
  id: string;
  label: string;
  format?: (value: number) => string;
  min?: number;
  max?: number;
  better?: "higher" | "lower";
  aggregate?: "last" | "average" | "max";
  sample?: () => number;
}
```

Use `sample` when a value can be read from a live source. Every registered sampler runs once per
refresh window, including metrics that are not currently visible.

```ts
recorder.addMetric({
  id: "calls",
  label: "draw calls",
  better: "lower",
  sample: () => renderer.info.render.calls
});
```

Use `track()` after registering a metric when the application already computed the value. Calls
made during one refresh window are combined with the metric's aggregation mode. The default is
`last`.

```ts
recorder.addMetric({
  id: "buildMs",
  label: "build",
  aggregate: "max"
});
recorder.track("buildMs", engine.debug.stats.buildTimeMs);
```

`snapshot()` returns every registered metric as a plain `Record<string, number>`. `history(id)`
returns a defensive copy ordered oldest to newest. `definitions` exposes the registered metric
metadata in cycling order. `subscribe(listener)` runs once per refresh window and returns an
unsubscribe function.

```ts
const unsubscribe = recorder.subscribe((snapshot) => {
  Object.assign(stats, snapshot);
  folder.refresh();
});
```

For tests and headless tools, the constructor accepts `performance`, `refreshInterval` in
milliseconds, and `historySize` overrides.

## `jolly-stats`

The root `@jolly-pixel/ui` entry registers `<jolly-stats>`. Give it a recorder; it subscribes to
snapshots and draws the selected metric on one compact canvas.

```ts
import "@jolly-pixel/ui";

const stats = document.createElement("jolly-stats");
stats.recorder = recorder;
document.body.append(stats);
```

Click, Enter, Space, or the down/right arrows to advance. Right-click or the up/left arrows move
backward. The selected metric persists in local storage; set `storage-key` to isolate multiple
displays, or assign a `StorageAdapter` through the `storage` property. Fixed `min` and `max` values
control the graph scale; omitted bounds auto-scale from history. The display re-resolves inherited
theme tokens when its theme scope or system colour scheme changes.
