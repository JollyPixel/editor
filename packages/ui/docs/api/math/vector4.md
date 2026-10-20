# `jolly-vector4`

`jolly-vector4` edits `x`, `y`, `z` and `w` in one field row.

```ts
const field = document.querySelector("jolly-vector4");
field.value = { x: 0, y: 0, z: 0, w: 1 };
```

## Properties

```ts
interface Vector4 {
  step: number; // default 0.1
  min: number; // default -Infinity
  max: number; // default Infinity
  axisLabels: Partial<Record<"x" | "y" | "z" | "w", string>>;
  axisStyle: AxisStyle;
}
```

See [axis markers](./axis-fields.md#axis-markers).
