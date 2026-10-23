# `jolly-number`

`jolly-number` edits an unbounded or bounded number. It implements the
[shared field API](../field/shared-field-api.md).

```html
<jolly-number label="Opacity" min="0" max="1" step="0.01"></jolly-number>
```

## Properties

```ts
interface NumberField {
  step: number; // default 1
  min: number; // default -Infinity
  max: number; // default Infinity
  value: number | typeof Mixed; // default 0
}
```

## Typed input

- Accepts decimal and scientific literals, parentheses, unary signs, and `+`,
  `-`, `*`, `/`.
- `,` is a decimal separator: `1,5` is `1.5`.
- Anything else is a parse error shown on the field, and nothing commits.
- Enter or blur commits. Escape discards the draft.

## Steps and scrubbing

- Arrow keys commit one step. Shift multiplies it by ten, Alt divides it by
  ten.
- Dragging the bar at the input's left edge scrubs the value. While dragging,
  the bar shrinks to a dot and a dotted arrow shows how far the value has
  moved. The arrow stops at `min` or `max`.
- Pointer scrubbing emits `jolly-input` while moving and `jolly-change` on
  release.
