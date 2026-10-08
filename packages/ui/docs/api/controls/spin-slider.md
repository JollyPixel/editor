# `jolly-spin-slider`

`jolly-spin-slider` edits a bounded number in a single text field, with a thin
bar along its bottom edge showing where the value sits in the range. It takes
less width than [`jolly-slider`](./slider.md), which puts the readout beside the
track. It implements the [shared field API](../field/shared-field-api.md).

```html
<jolly-spin-slider label="Intensity" min="0" max="2" step="0.01"></jolly-spin-slider>
```

## Properties

### `step`

`number`. Increment for dragging, arrow keys and typed values. Defaults to
`1`.

### `min`

`number`. Lower bound, at the bar's left end. Defaults to `0`.

### `max`

`number`. Upper bound, at the bar's right end. Defaults to `100`.

### `value`

`number | typeof Mixed`. Defaults to `0`. A mixed value shows the `Mixed`
placeholder and cannot be dragged.

## Interaction

Press anywhere on the field and move more than 3px to drag. The value moves
from where it was, and dragging across the bar's full width covers the whole
range. Shift multiplies the step by ten and Alt divides it by ten.

Press on the bar to jump to that point, then keep dragging from there.

Release without moving to start typing: the input takes focus with its text
selected. Typed input follows the same rules as
[`jolly-number`](./number.md): expressions are accepted, Enter or blur
commits, Escape discards the draft, and the arrow keys commit one step. While
the input has focus, a press on the text places the caret instead of
dragging; the bar still jumps.

Dragging and jumping emit `jolly-input` while the pointer moves and one
`jolly-change` on release. Escape during a drag restores the value from before
the press and emits no `jolly-change`. A disabled, read-only or locked field
cannot be dragged.

The input has the `spinbutton` role and exposes `aria-valuemin`,
`aria-valuemax` and `aria-valuenow`.

## Facade

A binding with `min`, `max` and `view: "spin"` builds this element. Without
both bounds the binding stays a `jolly-number`.

```ts
pane.addBinding(light, "intensity", {
  min: 0,
  max: 2,
  step: 0.01,
  view: "spin"
});
```
