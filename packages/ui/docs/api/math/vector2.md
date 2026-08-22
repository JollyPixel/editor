# `jolly-vector2`

`jolly-vector2` edits `x` and `y` numeric axes through one field row.

```ts
const field = document.querySelector("jolly-vector2");
field.value = { x: 0, y: 1 };
```

| Property | Type | Default |
|---|---|---|
| `step` | `number` | `0.1` |
| `min` | `number` | `-Infinity` |
| `max` | `number` | `Infinity` |
| `axisLabels` | `Partial<Record<"x" \| "y", string>>` | `{}` |

The component implements the [shared field API](../field/shared-field-api.md).
Each axis can hold `Mixed` independently. Axis edits emit the complete vector
through `jolly-input` and `jolly-change`.
