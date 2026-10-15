# `StatsRecorder`

`StatsRecorder` records frame timing and application metrics. It loads no Lit
and registers no element.

```ts
import { StatsRecorder } from "@jolly-pixel/ui/stats";

const recorder = new StatsRecorder();

function renderFrame(): void {
  recorder.begin();
  world.tick();
  renderer.render(scene, camera);
  recorder.end();
}
```

## Constructor

```ts
new StatsRecorder(options?: StatsRecorderOptions)

interface StatsRecorderOptions {
  historySize?: number; // snapshots kept per metric, default 60
  refreshInterval?: number; // ms between flushes, default 250
  performance?: { // default globalThis.performance
    now(): number;
    memory?: {
      usedJSHeapSize: number;
      jsHeapSizeLimit?: number;
    };
  };
}
```

- An invalid or non-positive `historySize` or `refreshInterval` uses its
  default.
- Inject `performance` for deterministic tests and headless hosts.

## Recording frames

### `begin(): void`

Stores the current time.

### `end(): void`

Records the elapsed duration and counts the frame. Without a matching
`begin()`, does nothing.

Once `refreshInterval` has elapsed, `end()` also flushes: it aggregates pending
values, samples pull metrics, appends to each history and notifies
subscribers. There is no timer and no separate flush method.

## Built-in metrics

Registered in this order:

- `fps` (`FPS`): frames over the window time. 0 to 100, higher is better.
- `ms` (`MS`): average `begin()` to `end()` duration. 0 to 200, lower.
- `worstMs` (`WORST MS`): longest duration. 0 to 200, lower.
- `mb` (`MB`): used JavaScript heap in MiB, up to the reported limit. Lower.
  Only when the performance source has `memory.usedJSHeapSize`.

## Custom metrics

### `addMetric(definition: MetricDefinition): () => void`

Registers a [metric](./metric-definition.md) and returns its unregister
function. Throws an `Error` for an empty or duplicate id.

### `track(id: string, value: number): void`

Pushes a value, reduced by the metric's `aggregate` at the next flush.
Ignores `NaN` and infinite values. Throws for an unknown id.

```ts
recorder.addMetric({
  id: "triangles",
  label: "TRIS",
  better: "lower",
  aggregate: "last"
});

recorder.track("triangles", renderer.info.render.triangles);
```

A metric with `sample()` is pulled once per flush instead. Use it for a cheap
live value, and `track()` for values that arrive as events or need
aggregation.

```ts
recorder.addMetric({
  id: "drawCalls",
  label: "CALLS",
  better: "lower",
  sample: () => renderer.info.render.drawCalls
});
```

### `addSource(source: MetricSource): () => void`

Registers every metric of a [`MetricSource`](./metric-definition.md#metricsource).

- The returned function unregisters them all. Call it when the source dies
  first, or its `sample()` closures keep running.
- A colliding id throws, and nothing of the source stays registered.

```ts
const release = recorder.addSource(engine.inspector);

release();
```

### `removeMetric(id: string): boolean`

Whether a metric was registered under that id.

### `revision: number`

Changes whenever metrics are added or removed, so a readout can tell that
`definitions` went stale.

## Reading

### `snapshot(): Record<string, number>`

The current value of every metric. A metric starts at `0`.

### `history(id: string): number[]`

An oldest-first copy, at most `historySize` long. Empty for an unknown metric
or before the first sample.

### `definitions: readonly MetricDefinition[]`

Copies, in registration order.

### `subscribe(listener: StatsListener): () => void`

The listener receives a snapshot once per flush. Call the returned function
on teardown.

```ts
const unsubscribe = recorder.subscribe((snapshot) => {
  console.log(snapshot.fps);
});
```

To display the recorder, assign it to [`jolly-stats`](./stats.md).
