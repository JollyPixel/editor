# Monitors

Two read-only elements, both driven by the application: neither polls, neither owns a timer.

## `jolly-monitor`

A label and value row.

| Property | Type | Default |
|---|---|---|
| `label` | `string` | `""` |
| `value` | `number \| string` | `""` |
| `format` | `(value: number) => string \| undefined` | `undefined` |

`format` is ignored for a string value.

## `jolly-graph`

A canvas sparkline over a ring buffer. Push a value; it appends and redraws.

| Property | Type | Default |
|---|---|---|
| `label` | `string` | `""` |
| `value` | `number` | `0` |
| `min` | `number \| undefined` | `undefined` |
| `max` | `number \| undefined` | `undefined` |
| `rows` | `number` | `3` |
| `samples` | `number` | `60` |
| `format` | `(value: number) => string \| undefined` | `undefined` |

Leaving `min` or `max` `undefined` auto-scales that end to the buffer's own observed extreme,
recomputed on every draw. A fixed ceiling like a theoretical max framerate is rarely known up
front and flattens the line whenever real values sit far below it; set both explicitly only when
the range genuinely is fixed, such as a percentage. `rows` sets height in multiples of
`--jolly-row-height`, matching Tweakpane's own `rows` option on a graph binding. `samples` caps the
ring buffer; the oldest value drops once it fills. Canvas can't read custom properties, so the
stroke colour resolves `--jolly-accent-fill` through `getComputedStyle` on each draw rather than
once at connect.

`format` draws the current value over the graph's top-right corner (`Math.round` when omitted), so
one `jolly-graph` reads on its own — a separate `jolly-monitor` for the same key next to it repeats
what the graph already shows.

## The facade's `view: "graph"` flag

`folder.addMonitor(state, key, options)` renders `jolly-monitor` by default. Passing
`{ view: "graph", min, max, rows, format }` renders `jolly-graph` instead:

```ts
folder.addMonitor(stats, "fps", { view: "graph", min: 0, rows: 3, format: formatCount });
folder.addMonitor(stats, "worstMs", { format: formatMilliseconds });
```

`formatCount`, `formatMilliseconds`, and `formatPercent` ship alongside both elements for the
common numeric readouts a performance panel wants.
