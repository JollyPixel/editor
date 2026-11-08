# `jolly-transform`

`jolly-transform` composes position, rotation and scale rows. It is not a
field: it has no `label`, `disabled`, `align` or `path` of its own.

```ts
const transform = document.querySelector("jolly-transform");
transform.value = {
  position: mesh.position,
  rotation: mesh.quaternion,
  scale: mesh.scale
};
```

## Properties

```ts
interface Transform {
  value: TransformLike; // property only, default identity
  default: TransformDefault | undefined; // property only
  state: TransformFieldState; // property only, per-row state
  positionLabel: string; // attribute position-label, default "Position"
  rotationLabel: string; // attribute rotation-label, default "Rotation"
  scaleLabel: string; // attribute scale-label, default "Scale"
  rotationFormat: "quaternion" | "euler"; // attribute rotation-format, default "quaternion"
  labelPosition: "inline" | "top" | "auto"; // attribute label-position
  stackBelow: number; // attribute stack-below, default 200
  axisStyle: AxisStyle | undefined; // attribute axis-style
}
```

- `state` sets `editors`, `disabled`, `readonly` and `error` on each
  row independently, so the three rows lock separately.
- A row edit emits `jolly-input` or `jolly-change` with a
  `TransformChangeDetail`: `value` is the whole transform and `field` names
  the edited row (`"position"`, `"rotation"` or `"scale"`). The row's own
  event stops at the transform.
- With `rotationFormat="euler"`, `value.rotation` and `default.rotation` are
  `{ x, y, z }` in degrees. The rotation row is then a `jolly-vector3` with a
  step of 1, and it emits the angles exactly as typed, with no quaternion
  conversion.
- With `labelPosition="auto"`, the three rows stack together, measured on the
  transform's own width. It reflects `stacked` while they do.
- `axisStyle` applies to all three rows. Unset, each row keeps its class
  default. See [axis markers](./axis-fields.md#axis-markers).
- `TransformDefault`, `TransformFieldState` and `TransformRotationFormat` are
  not exported from the root.
