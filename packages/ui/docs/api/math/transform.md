# `jolly-transform`

`jolly-transform` composes position, rotation, and scale fields.

```ts
const transform = document.querySelector("jolly-transform");
transform.value = {
  position: mesh.position,
  rotation: mesh.quaternion,
  scale: mesh.scale
};
```

| Property | Attribute | Type | Default |
|---|---|---|---|
| `value` | none | `TransformValue` | Identity transform |
| `default` | none | `TransformDefault \| undefined` | `undefined` |
| `state` | none | `TransformFieldState` | `{}` |
| `positionLabel` | `position-label` | `string` | `"Position"` |
| `rotationLabel` | `rotation-label` | `string` | `"Rotation"` |
| `scaleLabel` | `scale-label` | `string` | `"Scale"` |
| `labelPosition` | `label-position` | `"inline" \| "top"` | `"inline"` |

`state` applies `lockedBy`, `peers`, `disabled`, `readonly`, and `error` to
each sub-field independently. Sub-field edits emit `jolly-input` or
`jolly-change` with the complete merged transform value.

The `TransformValue`, `TransformDefault`, and `TransformFieldState` interfaces
are declared by the implementation module but are not exported from the
package root. Consumers can use the structural shapes shown above.
