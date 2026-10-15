# `jolly-point2d`

`jolly-point2d` edits two bounded axes through a draggable pad. It implements
the [shared field API](../field/shared-field-api.md).

```html
<jolly-point2d label="Anchor" min="0" max="1" step="0.01"></jolly-point2d>
```

## Properties

```ts
interface Point2d {
  step: number; // default 0.01
  min: number; // default 0
  max: number; // default 1
  value: VectorValue<"x" | "y">; // default { x: 0, y: 0 }
  default: VectorValue<"x" | "y"> | undefined;
}
```

- Pointer movement emits `jolly-input`, release emits `jolly-change`.
- A pad edit sets both axes together.
