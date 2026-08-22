# `jolly-stats`

`jolly-stats` displays one metric and its oldest-first history from a
[`StatsRecorder`](./stats-recorder.md).

```ts
import "@jolly-pixel/ui";
import { StatsRecorder } from "@jolly-pixel/ui/stats";

const recorder = new StatsRecorder();
const stats = document.createElement("jolly-stats");
stats.recorder = recorder;
stats.storageKey = "renderer:stats";
document.body.append(stats);
```

| Property | Attribute | Type | Default |
|---|---|---|---|
| `recorder` | none | `StatsRecorder \| null` | `null` |
| `storageKey` | `storage-key` | `string` | `"jolly-stats"` |
| `storage` | none | `StorageAdapter` | `LocalStorageAdapter` |

The selected metric is saved under `${storageKey}:metric`. Replacing
`recorder`, `storage`, or `storageKey` restores a valid saved metric or
selects the recorder's first definition.

Click, Enter, Space, ArrowRight, or ArrowDown selects the next metric.
Right-click, ArrowLeft, or ArrowUp selects the previous metric. Selection wraps
at both ends.

The element subscribes when connected and whenever `recorder` changes. It
unsubscribes when disconnected. Its accessible name contains the selected
metric label and formatted value.

## Graph behavior

The canvas draws the selected metric's history. `min` and `max` from its
[`MetricDefinition`](./metric-definition.md) fix graph bounds; omitted bounds
follow the recorded history. The canvas tracks its rendered size through
`ResizeObserver` when that API is available.

Built-in metrics use their dedicated theme colors. A custom metric with
`better: "higher"` uses the success color, while `better: "lower"` uses the
warning color.
