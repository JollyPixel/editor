# `jolly-vector4`

`jolly-vector4` edits `x`, `y`, `z`, and `w` numeric axes through one field
row.

```ts
const field = document.querySelector("jolly-vector4");
field.value = { x: 0, y: 0, z: 0, w: 1 };
```

| Property | Type | Default |
|---|---|---|
| `step` | `number` | `0.1` |
| `min` | `number` | `-Infinity` |
| `max` | `number` | `Infinity` |
| `axisLabels` | `Partial<Record<"x" \| "y" \| "z" \| "w", string>>` | `{}` |

The component implements the [shared field API](../field/shared-field-api.md).
Each axis can hold `Mixed` independently.
