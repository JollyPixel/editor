# `jolly-graph`

`jolly-graph` draws recent numeric values as a canvas sparkline.
`GraphDefaults` describes its `rows` and `samples` defaults.

```ts
const graph = document.querySelector("jolly-graph");
graph.label = "Frame time";
graph.value = 16.7;
```

| Property | Type | Default |
|---|---|---|
| `label` | `string` | `""` |
| `value` | `number` | `0` |
| `min` | `number \| undefined` | `undefined` |
| `max` | `number \| undefined` | `undefined` |
| `rows` | `number` | `3` |
| `samples` | `number` | `60` |
| `format` | `(value: number) => string \| undefined` | `undefined` |

Assigning `value` appends a sample. Omitted bounds follow the observed buffer
extremes. `samples` limits the ring buffer. The current value is drawn over the
graph and uses `Math.round` when `format` is absent.
