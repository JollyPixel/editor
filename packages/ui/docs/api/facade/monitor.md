# Monitor facade

`addMonitor(object, key, options?)` creates a read-only row for a number,
string, or vector property.

```ts
type MonitorValue = number | string | Vec2Like | Vec3Like | Vec4Like;

interface MonitorOptions<TValue = MonitorValue> {
  label?: string;
  format?: (value: TValue) => string;
  view?: "graph";
  min?: number;
  max?: number;
  rows?: number;
  precision?: number;
}
```

The default element is `jolly-monitor`. `view: "graph"` creates
`jolly-graph`; `min`, `max`, and `rows` are applied only to that graph, which
plots numbers.

`format` receives the property value itself, whatever its shape, and its
result is displayed as given. Without it a vector value is joined into
`x, y, z`, each axis rounded to `precision` decimals with trailing zeros
dropped.

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

A vector monitor reads the live object, so a `THREE.Vector3` can be handed
over directly:

```ts
const min = pane.addMonitor(area, "position", {
  label: "Min corner",
  precision: 1
});
```

| Option | Default | Behavior |
|---|---|---|
| `precision` | `2` | Decimals kept per axis when a vector value is formatted. Ignored when `format` is set. |

The builder reads the property during construction. Later assignments require
`monitor.refresh()` or `pane.refresh()`. Assigning a new value to a graph
during refresh appends one graph sample.

## Add several monitors

`addMonitors(object, fields)` adds each configured property and returns
`void`.

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
`MonitorValue`, and types each entry's `format` against that key's own value.
An entry set to `undefined` is skipped.

The returned single-monitor builder exposes `element`, `hidden`, `disabled`,
`refresh()`, and `dispose()`.
