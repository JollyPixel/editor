# `jolly-spin-slider`

`jolly-spin-slider` edits a bounded number in one text field, with a thin bar
along its bottom edge showing where the value sits. It is narrower than
[`jolly-slider`](./slider.md). It implements the
[shared field API](../field/shared-field-api.md).

```html
<jolly-spin-slider label="Intensity" min="0" max="2" step="0.01"></jolly-spin-slider>
```

## Properties

```ts
interface SpinSlider {
  step: number; // drag, arrow and typed increment, default 1
  min: number; // default 0
  max: number; // default 100
  value: number | typeof Mixed; // default 0, Mixed cannot be dragged
}
```

## Pointer

- Press and move more than 3px to drag from the current value. The bar's full
  width covers the whole range. Shift multiplies the step by ten, Alt divides
  it by ten.
- Press on the bar to jump there, then keep dragging.
- Release without moving to type: the input takes focus with its text
  selected.
- Dragging emits `jolly-input`, release one `jolly-change`.
- Escape during a drag restores the value from before the press.
- A disabled, read-only or locked field cannot be dragged.

## Typing

- Same rules as [`jolly-number`](./number.md).
- While focused, a press on the text places the caret. The bar still jumps.
- The input is a `spinbutton` named by `label`.

## Facade

`view: "spin"` on a binding with `min` and `max` builds this element. See
[control selection](../facade/binding.md#control-selection).
