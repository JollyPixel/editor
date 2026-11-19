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
  noSteppers: boolean; // default false, attribute no-steppers
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
- The up and down arrows at the input's right edge step the value, with the
  same Shift and Alt modifiers. Holding one repeats the step. A press emits
  `jolly-input` for each step and one `jolly-change` on release; Escape or a
  cancelled pointer restores the starting value with `jolly-input`.
- The arrows are hidden on a disabled, read-only, locked, or mixed field, and
  when `noSteppers` is set. An arrow at `min` or `max` is dimmed.
