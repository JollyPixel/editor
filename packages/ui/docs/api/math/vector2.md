# `jolly-vector2`

`jolly-vector2` edits two numeric axes in one field row.

```ts
const field = document.querySelector("jolly-vector2");
field.value = { x: 0, y: 1 };
```

## Properties

```ts
interface Vector2 {
  axes: "xy" | "xz" | "yz"; // default "xy"
  step: number; // default 0.1
  min: number; // default -Infinity
  max: number; // default Infinity
  axisLabels: Partial<Record<"x" | "y" | "z", string>>; // accessible names
  axisStyle: AxisStyle; // see axis markers
}
```

See [axis markers](./axis-fields.md#axis-markers).

## Choosing a plane

`axes` is the plane. The axis key is the identity: the key `value` carries,
the glyph and the colour.

```html
<jolly-vector2 label="Size" axes="xz" step="1" min="1"></jolly-vector2>
```

```ts
field.value = { x: 4, z: 6 };
```

- `axisLabels` renames an axis for assistive technology only. For a value
  carrying `x` and `z`, set `axes`, not labels.
- Changing `axes` on a mounted field moves the numbers by position:
  `{ x: 2, y: 5 }` becomes `{ x: 2, z: 5 }`. A `value` with the new axes
  assigned in the same update wins.
- An unknown pair falls back to `"xy"`.
