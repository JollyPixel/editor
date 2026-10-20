# Monitor facade

`addMonitor(object, key, options?)` creates a read-only row for a number,
string or vector property.

```ts
const stats = {
  status: "ready",
  frameMs: 0
};

pane.addMonitor(stats, "status");
pane.addMonitor(stats, "frameMs", {
  label: "Frame",
  view: "graph",
  min: 0,
  max: 50,
  rows: 3,
  format: (value) => `${value.toFixed(1)} ms`
});
```

## Options

```ts
type MonitorValue = number | string | Vec2Like | Vec3Like | Vec4Like;

interface MonitorOptions<TValue = MonitorValue> {
  label?: string;
  format?: (value: TValue) => string; // receives the raw value
  view?: "graph"; // jolly-graph instead of jolly-monitor
  min?: number; // graph only
  max?: number; // graph only
  rows?: number; // graph only
  precision?: number; // decimals per vector axis, default 2
}
```

- Without `format`, a vector is joined into `x, y, z`, trailing zeros
  dropped.
- A vector monitor reads the live object, so a `THREE.Vector3` can be passed
  as is.

## Refreshing

- The value is read once, at construction. Call `monitor.refresh()` or
  `pane.refresh()` after an assignment.
- Facade monitors have no timer: refresh on your own cadence.
- Each refresh of a graph appends one sample.

## `addMonitors(object, fields): void`

Adds one monitor per configured key.

```ts
pane.addMonitors(stats, {
  status: { label: "State" },
  frameMs: {
    label: "Frame",
    format: (value) => `${value.toFixed(1)} ms`
  }
});
```

- `MonitorFields<TObject>` accepts only keys holding a `MonitorValue`, and
  types each `format` against that key's value.
- An entry set to `undefined` is skipped.

## Builder

`FacadeMonitor` adds `refresh()` to the
[builder surface](./builders.md#builder-surface).
