# Metric definitions

`MetricDefinition` describes one `StatsRecorder` value and how
`jolly-stats` displays it.

```ts
interface MetricDefinition {
  id: string;
  label: string;
  format?: (value: number) => string;
  min?: number;
  max?: number;
  better?: "higher" | "lower";
  aggregate?: "last" | "average" | "max";
  palette?: MetricPalette;
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
| `format` | Display | Formats the numeric readout. The default rounds with `Math.round`. |
| `min`, `max` | Display | Fixed graph bounds. An omitted bound follows recorded history. |
| `better` | Display | Default ink: the success color for `"higher"`, the warning color for `"lower"`, the accent otherwise. |
| `palette` | Display | Graph and readout colors. Each omitted color falls back to the default. |
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
`MetricRange`, and `resolveMetricRange()` are exported from `@jolly-pixel/ui/stats`.

