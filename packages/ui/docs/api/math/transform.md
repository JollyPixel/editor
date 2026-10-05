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
| `labelPosition` | `label-position` | `"inline" \| "top" \| "auto"` | `"inline"` |
| `stackBelow` | `stack-below` | `number` | `200` |
| `axisStyle` | `axis-style` | `AxisStyle \| undefined` | `undefined` |

With `labelPosition="auto"` the transform measures its own width against
`stackBelow` and stacks its three rows together, rather than letting each row
decide alone. It reflects `stacked` while they are.

`axisStyle` is passed to all three rows. Left `undefined`, each row keeps its
own class default, `Vector3.Defaults.axisStyle` or
`Quaternion.Defaults.axisStyle`. See [axis markers](./README.md#axis-markers).

`state` applies `lockedBy`, `peers`, `disabled`, `readonly`, and `error` to
each sub-field independently. Sub-field edits emit `jolly-input` or
`jolly-change` with the complete merged transform value.

The `TransformValue`, `TransformDefault`, and `TransformFieldState` interfaces
are declared by the implementation module but are not exported from the
package root. Consumers can use the structural shapes shown above.
