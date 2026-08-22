# `jolly-point2d`

`jolly-point2d` edits two bounded axes through a draggable pad.

```html
<jolly-point2d label="Anchor" min="0" max="1" step="0.01"></jolly-point2d>
```

| Property | Type | Default |
|---|---|---|
| `step` | `number` | `0.01` |
| `min` | `number` | `0` |
| `max` | `number` | `1` |
| `value` | `VectorValue<"x" \| "y"> \| typeof Mixed` | `{ x: 0, y: 0 }` |
| `default` | `VectorValue<"x" \| "y"> \| undefined` | `undefined` |

The component implements the [shared field API](../field/shared-field-api.md).
Pointer movement emits `jolly-input`; release emits `jolly-change`. A pad edit
sets both axes together.
