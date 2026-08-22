# Monitor facade

`addMonitor(object, key, options?)` creates a read-only row for a number or
string property.

```ts
interface MonitorOptions {
  label?: string;
  format?: (value: number) => string;
  view?: "graph";
  min?: number;
  max?: number;
  rows?: number;
}
```

The default element is `jolly-monitor`. `view: "graph"` creates
`jolly-graph`; `min`, `max`, and `rows` are applied only to that graph.
`format` is applied to numeric values and ignored for strings.

```ts
const stats = {
  status: "ready",
  frameMs: 0
};

const status = pane.addMonitor(stats, "status");
const frame = pane.addMonitor(stats, "frameMs", {
  label: "Frame",
  view: "graph",
  min: 0,
  max: 50,
  rows: 3,
  format: (value) => `${value.toFixed(1)} ms`
});
```

The builder reads the property during construction. Later assignments require
`monitor.refresh()` or `pane.refresh()`. Assigning a new value to a graph
during refresh appends one graph sample.

## Add several monitors

`addMonitors(object, fields)` adds each configured number or string property
and returns `void`.

```ts
pane.addMonitors(stats, {
  status: { label: "State" },
  frameMs: {
    label: "Frame",
    format: (value) => `${value.toFixed(1)} ms`
  }
});
```

`MonitorFields<TObject>` accepts only keys whose values are assignable to
`number | string`. An entry set to `undefined` is skipped.

The returned single-monitor builder exposes `element`, `hidden`, `disabled`,
`refresh()`, and `dispose()`.
