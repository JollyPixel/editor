# `jolly-quaternion`

`jolly-quaternion` edits Euler angles in degrees while exposing a quaternion
value.

```ts
const field = document.querySelector("jolly-quaternion");
field.value = mesh.quaternion;
```

| Property | Type | Default |
|---|---|---|
| `step` | `number` | `1` degree |
| `axisLabels` | `Partial<Record<"x" \| "y" \| "z", string>>` | `{}` |
| `value` | `QuatLike \| typeof Mixed` | `{ x: 0, y: 0, z: 0, w: 1 }` |
| `default` | `QuatLike \| undefined` | `undefined` |

The component implements the [shared field API](../field/shared-field-api.md).
Conversion uses XYZ Euler order. Axis edits emit a complete `QuatLike` value.
