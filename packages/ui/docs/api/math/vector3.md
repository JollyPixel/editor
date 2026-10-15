# `jolly-vector3`

`jolly-vector3` edits `x`, `y` and `z` in one field row. A `THREE.Vector3`
can be assigned directly.

```ts
const field = document.querySelector("jolly-vector3");
field.value = mesh.position;
```

## Properties

```ts
interface Vector3 {
  step: number; // default 0.1
  min: number; // default -Infinity
  max: number; // default Infinity
  axisLabels: Partial<Record<"x" | "y" | "z", string>>;
  axisStyle: AxisStyle;
}
```

See [axis markers](./README.md#axis-markers).
