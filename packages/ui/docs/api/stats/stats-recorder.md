# `StatsRecorder`

`StatsRecorder` records frame timing and application metrics without loading
Lit or registering custom elements.

```ts
import { StatsRecorder } from "@jolly-pixel/ui/stats";

const recorder = new StatsRecorder();
```

## Constructor

```ts
new StatsRecorder(options?: StatsRecorderOptions)

interface StatsRecorderOptions {
  historySize?: number;
  refreshInterval?: number;
  performance?: {
    now(): number;
    memory?: {
      usedJSHeapSize: number;
      jsHeapSizeLimit?: number;
    };
  };
}
```

| Option | Default | Behavior |
|---|---|---|
| `historySize` | `60` | Maximum snapshots retained for each metric. |
| `refreshInterval` | `250` | Minimum elapsed milliseconds between flushes. |
| `performance` | `globalThis.performance` | Timing source and optional memory source. |

A non-positive or invalid `historySize` or `refreshInterval` uses its default.
The injectable performance source supports deterministic tests and headless
hosts.

## Record a frame

Place `begin()` before the measured frame work and `end()` after it.

```ts
function renderFrame(): void {
  recorder.begin();
  world.tick();
  renderer.render(scene, camera);
  recorder.end();
}
```

`begin()` stores the current time. `end()` records the non-negative elapsed
duration and increments the frame count. Calling `end()` without a matching
`begin()` has no effect.

`end()` also controls the refresh window. Once at least `refreshInterval`
milliseconds have elapsed, it aggregates pending values, samples pull metrics,
appends one value to each affected history, and notifies subscribers. The
recorder has no timer and no separate flush method.

## Built-in metrics

The constructor registers metrics in this order:

| ID | Label | Value per refresh window | Bounds | Direction |
|---|---|---|---|---|
| `fps` | `FPS` | Frames divided by elapsed window time | 0 to 100 | Higher |
| `ms` | `MS` | Average `begin()` to `end()` duration | 0 to 200 | Lower |
| `worstMs` | `WORST MS` | Maximum duration | 0 to 200 | Lower |
| `mb` | `MB` | Current used JavaScript heap in mebibytes | 0 to the reported heap limit when available | Lower |

`mb` is registered only when the performance source exposes
`memory.usedJSHeapSize`.

## Push a custom metric

Use `addMetric()` once, then call `track()` whenever the application produces
a value.

```ts
recorder.addMetric({
  id: "triangles",
  label: "TRIS",
  better: "lower",
  aggregate: "last"
});

function renderFrame(): void {
  recorder.begin();
  renderer.render(scene, camera);
  recorder.track(
    "triangles",
    renderer.info.render.triangles
  );
  recorder.end();
}
```

```ts
addMetric(definition: MetricDefinition): void
track(id: string, value: number): void
```

An empty metric ID, a duplicate ID, or tracking an unknown ID throws an
`Error`. `track()` ignores `NaN` and infinite values.

Pending values are reduced when the window flushes:

| Aggregation | Result |
|---|---|
| `"last"` | Last pending value. This is the default. |
| `"average"` | Arithmetic mean of pending values. |
| `"max"` | Largest pending value. |

See [Metric definitions](./metric-definition.md) for display metadata and graph
bounds.

## Pull a custom metric

A metric with `sample()` reads its value once during each flush.

```ts
recorder.addMetric({
  id: "drawCalls",
  label: "CALLS",
  better: "lower",
  sample: () => renderer.info.render.drawCalls
});
```

Use a sampled metric for a live source that is cheap to read at refresh time.
Use `track()` when values arrive as events or several observations must be
aggregated within the window.

## Read values and history

```ts
snapshot(): Record<string, number>
history(id: string): number[]
get definitions(): readonly MetricDefinition[]
```

`snapshot()` returns the current value for every registered metric. A metric
starts at `0` and changes after its first flushed sample.

`history(id)` returns an oldest-first copy containing at most `historySize`
values. It returns an empty array for an unknown metric or before the first
sample. Mutating the returned array does not change the recorder.

`definitions` returns metric metadata in registration order. The returned
array and each definition object are copies.

## Subscribe to refreshes

```ts
subscribe(listener: StatsListener): () => void
```

The listener receives a new snapshot once per flush. Save and call the returned
function during teardown.

```ts
const unsubscribe = recorder.subscribe((snapshot) => {
  console.log(snapshot.fps);
});

unsubscribe();
```

To render the recorder, assign it to [`jolly-stats`](./stats.md).

