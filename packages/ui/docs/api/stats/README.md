# Stats API

The stats package separates recording from rendering:

- [`StatsRecorder`](./stats-recorder.md) is a DOM-free frame and metric
  recorder.
- [Metric definitions](./metric-definition.md) configure aggregation,
  formatting, and graph bounds, and `MetricSource` lets another package
  describe metrics without depending on this one.
- [`jolly-stats`](./stats.md), exported as `StatsElement`, renders one
  recorder metric and its history.

Import the headless API from the stats subpath:

```ts
import {
  StatsRecorder,
  resolveMetricFormat,
  resolveMetricRange,
  type MetricDefinition,
  type MetricSource
} from "@jolly-pixel/ui/stats";
```

Import `@jolly-pixel/ui` when the application also needs the registered
`jolly-stats` element.

