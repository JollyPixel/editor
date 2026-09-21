# Metric definitions

`MetricDefinition` describes one `StatsRecorder` value and how
`jolly-stats` displays it.

```ts
interface MetricDefinition {
  id: string;
  label: string;
  format?: (value: number) => string;
  unit?: "count" | "integer" | "decimal" | "ms" | "percent";
  group?: string;
  min?: number;
  max?: number;
  better?: "higher" | "lower";
  aggregate?: "last" | "average" | "max";
  palette?: MetricPalette;
  tile?: boolean;
  sample?: () => number;
}

interface MetricPalette {
  ink?: string;
  bed?: string;
}
```

| Property | Consumer | Behavior |
|---|---|---|
| `id` | Recorder and display | Unique, non-empty lookup key. |
| `label` | Display | Text shown beside the current value. |
| `format` | Display | Formats the numeric readout. Takes precedence over `unit`. |
| `unit` | Display | Names a formatter instead of carrying one. |
| `group` | Display | Folder a full readout files the metric under. Ignored by `jolly-stats`. |
| `min`, `max` | Display | Fixed graph bounds. An omitted bound follows recorded history. |
| `better` | Display | Default ink: the success color for `"higher"`, the warning color for `"lower"`, the accent otherwise. |
| `palette` | Display | Graph and readout colors. Each omitted color falls back to the default. |
| `tile` | Display | `false` keeps the metric out of the `jolly-stats` cycle, leaving it to a full readout. Defaults to `true`. |
| `aggregate` | Recorder | Reduces values pending in one refresh window. Defaults to `"last"`. |
| `sample` | Recorder | Reads one value immediately before a refresh window is aggregated. |

`ink` colors the readout and the bars, `bed` the background. Each is a CSS
color and may use `var()`, `light-dark()`, or `color-mix()`, resolved on the
`jolly-stats` element. An invalid color uses the default.

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

The recorder stores a shallow copy of the definition. Display properties do not
clamp, transform, or reject recorded values.

## Units instead of formatters

A definition either carries a `format` or names the `unit` it measures. The
unit exists so a package describing metrics does not have to depend on this one
for a formatter; a display resolves it.

```ts
resolveMetricFormat(
  definition: MetricDefinition
): (value: number) => string
```

`format` wins when a definition carries one, the unit's formatter comes next,
and a definition naming neither is formatted as a whole number.

| Unit | Formatter | `1234.5` reads |
|---|---|---|
| `count` | `formatCount` | `1,235` |
| `integer` | `formatInteger` | `1235` |
| `decimal` | `formatDecimal` | `1234.5` |
| `ms` | `formatMilliseconds` | `1234.5 ms` |
| `percent` | `formatPercent` | `1234.5 %` |

## Describing metrics from another package

`MetricSource` is the contract a subsystem answers to hand its metrics to a
recorder.

```ts
interface MetricSource {
  readonly metrics: readonly MetricDefinition[];
}
```

It is structural: a source satisfies it by shape and never imports this
package. `@jolly-pixel/voxel.renderer` declares its own `VoxelMetric` for that
reason, and pins the compatibility with a type test rather than a dependency.

## Fixed and observed graph ranges

```ts
resolveMetricRange(
  definition: MetricDefinition,
  history: readonly number[]
): MetricRange

interface MetricRange {
  min: number;
  max: number;
}
```

Each defined bound is returned unchanged. An omitted bound uses the lowest or
highest history value. Empty history resolves an omitted bound to `0`.

```ts
resolveMetricRange(
  {
    id: "frameMs",
    label: "MS",
    min: 0
  },
  [12, 20, 16]
);
// { min: 0, max: 20 }
```

`MetricDefinition`, `MetricAggregation`, `MetricDirection`, `MetricPalette`,
`MetricRange`, `MetricSource`, `MetricUnit`, `resolveMetricFormat()`, and
`resolveMetricRange()` are exported from `@jolly-pixel/ui/stats`.

