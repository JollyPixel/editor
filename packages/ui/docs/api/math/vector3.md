# `jolly-vector3`

`jolly-vector3` edits `x`, `y`, and `z` numeric axes through one field row.

```ts
const field = document.querySelector("jolly-vector3");
field.value = mesh.position;
```

| Property | Type | Default |
|---|---|---|
| `step` | `number` | `0.1` |
| `min` | `number` | `-Infinity` |
| `max` | `number` | `Infinity` |
| `axisLabels` | `Partial<Record<"x" \| "y" \| "z", string>>` | `{}` |

The component implements the [shared field API](../field/shared-field-api.md).
Structural values such as `THREE.Vector3` can be assigned directly. Axis edits
emit the complete vector.
