# `jolly-quaternion`

`jolly-quaternion` edits Euler angles in degrees, XYZ order, and holds a
quaternion value.

```ts
const field = document.querySelector("jolly-quaternion");
field.value = mesh.quaternion;
```

## Properties

```ts
interface Quaternion {
  step: number; // degrees, default 1
  axisLabels: Partial<Record<"x" | "y" | "z", string>>;
  axisStyle: AxisStyle;
  value: QuatLike | typeof Mixed; // default { x: 0, y: 0, z: 0, w: 1 }
  default: QuatLike | undefined;
}
```

See [axis markers](./README.md#axis-markers).
