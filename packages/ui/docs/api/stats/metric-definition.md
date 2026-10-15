# Metric definitions

`MetricDefinition` describes one `StatsRecorder` value and how `jolly-stats`
displays it. Everything below is exported from `@jolly-pixel/ui/stats`.

```ts
interface MetricDefinition {
  id: string; // unique, non-empty
  label: string; // shown beside the value
  format?: (value: number) => string; // wins over unit
  unit?: MetricUnit;
  group?: string; // folder in a full readout, ignored by jolly-stats
  min?: number; // fixed graph bound, else follows history
  max?: number;
  better?: "higher" | "lower"; // default ink: success, warning, else accent
  aggregate?: "last" | "average" | "max"; // recorder, default "last"
  palette?: MetricPalette;
  tile?: boolean; // false: left out of the jolly-stats cycle, default true
  sample?: () => number; // recorder, read just before each flush
}

interface MetricPalette {
  ink?: string; // readout and bars
  bed?: string; // background
}
```

- `aggregate` reduces the values pushed in one window: the last one, their
  mean, or the largest.
- Palette colours may use `var()`, `light-dark()` or `color-mix()`, resolved
  on the `jolly-stats` element. An invalid colour uses the default.
- The recorder stores a shallow copy. Display fields never clamp or reject
  recorded values.

```ts
recorder.addMetric({
  id: "triangles",
  label: "TRIS",
  palette: {
    ink: "var(--app-tris, light-dark(#5b3cc4, #b69cff))",
    bed: "light-dark(#ece6ff, #1a1033)"
  }
});
```

## Units

A `unit` lets a package describe a metric without importing a formatter.

```ts
type MetricUnit = "count" | "integer" | "decimal" | "ms" | "percent" | "bytes";
```

How `1234.5` reads:

- `count` (`formatCount`): `1,235`.
- `integer` (`formatInteger`): `1235`.
- `decimal` (`formatDecimal`): `1234.5`.
- `ms` (`formatMilliseconds`): `1234.5 ms`.
- `percent` (`formatPercent`): `1234.5 %`.
- `bytes` (`formatBytes`): `1.2 KiB`.

### `resolveMetricFormat(definition): (value: number) => string`

`format`, then the unit's formatter, then a whole number.

## `MetricSource`

```ts
interface MetricSource {
  readonly metrics: readonly MetricDefinition[];
}
```

Structural: a subsystem satisfies it by shape, without importing this package.
`@jolly-pixel/voxel.renderer` declares its own `VoxelMetric` and pins the
compatibility with a type test.

## Graph ranges

### `resolveMetricRange(definition, history: readonly number[]): MetricRange`

```ts
interface MetricRange {
  min: number;
  max: number;
}

resolveMetricRange({ id: "frameMs", label: "MS", min: 0 }, [12, 20, 16]);
// { min: 0, max: 20 }
```

A defined bound is kept. An omitted one takes the lowest or highest history
value, or `0` for an empty history.

## Exported types

`MetricDefinition`, `MetricAggregation`, `MetricDirection`, `MetricPalette`,
`MetricRange`, `MetricSource`, `MetricUnit`.
