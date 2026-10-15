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
  labelPosition: "inline" | "top" | "auto"; // attribute label-position
  stackBelow: number; // attribute stack-below, default 200
  axisStyle: AxisStyle | undefined; // attribute axis-style
}
```

- `state` sets `lockedBy`, `peers`, `disabled`, `readonly` and `error` on each
  row independently, so the three rows lock separately.
- A row edit emits `jolly-input` or `jolly-change` with the whole transform.
- With `labelPosition="auto"`, the three rows stack together, measured on the
  transform's own width. It reflects `stacked` while they do.
- `axisStyle` applies to all three rows. Unset, each row keeps its class
  default. See [axis markers](./README.md#axis-markers).
- `TransformDefault` and `TransformFieldState` are not exported from the root.
