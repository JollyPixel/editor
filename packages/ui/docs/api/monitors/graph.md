# `jolly-graph`

`jolly-graph` draws recent numeric values as a canvas sparkline.

```ts
const graph = document.querySelector("jolly-graph");
graph.label = "Frame time";
graph.value = 16.7;
```

## Properties

```ts
interface GraphElement {
  label: string;
  value: number; // each assignment appends a sample
  min: number | undefined; // omitted: follows the buffer
  max: number | undefined;
  rows: number; // default 3
  samples: number; // ring buffer size, default 60
  format: ((value: number) => string) | undefined; // default Math.round
}
```

- The current value is drawn over the graph.
- `GraphDefaults` holds the `rows` and `samples` defaults.
