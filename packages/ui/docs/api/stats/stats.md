# `jolly-stats`

`jolly-stats` shows one metric of a [`StatsRecorder`](./stats-recorder.md) and
its history graph.

```ts
import "@jolly-pixel/ui/elements/stats";
import { StatsRecorder } from "@jolly-pixel/ui/stats";

const recorder = new StatsRecorder();
const stats = document.createElement("jolly-stats");
stats.recorder = recorder;
stats.storageKey = "renderer:stats";
document.body.append(stats);
```

## Properties

```ts
interface StatsElement {
  recorder: StatsRecorder | null; // property only
  storageKey: string; // attribute storage-key, default "jolly-stats"
  storage: StorageAdapter; // property only, default LocalStorageAdapter
}
```

- The selected metric is saved under `${storageKey}:metric`. An empty
  `storageKey` turns that off.
- Changing `recorder`, `storage` or `storageKey` restores a valid saved metric,
  or selects the first one.
- The element subscribes while connected.

## Selecting a metric

- Click, Enter, Space, ArrowRight or ArrowDown: next metric.
- Right-click, ArrowLeft or ArrowUp: previous metric.
- Selection wraps. Metrics with `tile: false` are skipped.
- The accessible name holds the metric label and formatted value.

## Graph

- `min` and `max` of the [definition](./metric-definition.md) fix the bounds.
  An omitted bound follows the history.
- Colours come from the definition's `palette`, defaulting from `better`.
- Built-in colours: `--jolly-stats-fps`, `--jolly-stats-ms`,
  `--jolly-stats-worst`, `--jolly-stats-mb`, and the matching `-bed`
  properties.
