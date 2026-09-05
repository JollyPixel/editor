# `jolly-vector2`

`jolly-vector2` edits two numeric axes through one field row.

```ts
const field = document.querySelector("jolly-vector2");
field.value = { x: 0, y: 1 };
```

| Property | Type | Default |
|---|---|---|
| `axes` | `"xy" \| "xz" \| "yz"` | `"xy"` |
| `step` | `number` | `0.1` |
| `min` | `number` | `-Infinity` |
| `max` | `number` | `Infinity` |
| `axisLabels` | `Partial<Record<"x" \| "y" \| "z", string>>` | `{}` |

The component implements the [shared field API](../field/shared-field-api.md).
Each axis can hold `Mixed` independently. Axis edits emit the complete vector
through `jolly-input` and `jolly-change`.

## Choosing a plane

`axes` names the plane the field edits, and the axis key is the identity: it is
the key `value` carries, the glyph in the corner chip, and the axis colour. A
field sizing a box across the ground plane reads as X and Z, in red and blue,
and hands back the keys the bound object already uses.

```html
<jolly-vector2 label="Size" axes="xz" step="1" min="1"></jolly-vector2>
```

```ts
field.value = { x: 4, z: 6 };
```

`axisLabels` overrides an axis's accessible name for a domain term. It does not
change the key, the glyph or the colour, so a field whose value is `x` and `z`
sets `axes`, not a pair of labels.

Setting `axes` on a mounted field moves each axis's number by position, so `xy`
holding `{ x: 2, y: 5 }` becomes `{ x: 2, z: 5 }`. Assigning a `value` that
already carries the new axes in the same update wins over that, which is the
common case of a template binding both together. An unknown pair falls back to
`"xy"`.
