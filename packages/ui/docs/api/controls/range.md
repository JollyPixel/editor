# `jolly-range`

`jolly-range` edits an `Interval` with `from` and `to` values. It implements
the [shared field API](../field/shared-field-api.md).

```ts
const field = document.querySelector("jolly-range");
field.value = { from: 10, to: 30 };
```

| Property | Type | Default |
|---|---|---|
| `step` | `number` | `1` |
| `min` | `number` | `0` |
| `max` | `number` | `100` |
| `value` | `Interval \| typeof Mixed` | `{ from: 0, to: 100 }` |

Endpoints cannot cross. A committed value is quantized to `step`, clamped to
the component bounds, then clamped against the other endpoint. Enter, blur,
and arrow-key stepping emit `jolly-change`.
