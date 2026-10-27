# `jolly-tool-button`

`jolly-tool-button` is a square icon button for rails and floating toolbars.
It can hold a flyout of related options.

```html
<jolly-tool-button icon="plus" label="Add" flyout-side="above">
  <jolly-tool-button slot="flyout" icon="close" label="Remove"></jolly-tool-button>
</jolly-tool-button>
```

## Properties

```ts
interface ToolButton {
  icon: IconName | undefined; // unset: only slotted content, such as a number
  label: string; // accessible name and tooltip
  tone: IconTone | ""; // default: the tone of icon
  active: boolean; // accent fill, aria-pressed without a flyout
  disabled: boolean;
  flyoutSide: "above" | "below" | "left" | "right"; // attribute flyout-side, default "right"
  open: boolean;
  count: number; // corner badge, hidden at 0
}
```

- A toned button tints its hover and `active` fill with the tone.
- `count` shows a number in the bottom-right corner, such as the undo depth.
  The badge is hidden from assistive technology: put anything it must hear in
  `label`.
- The tooltip opens on `flyout-side`.

## Methods

### `show(): void`

Opens the flyout. Does nothing without flyout content or while disabled.

### `hide(): void`

Closes it.

## Flyout

Content in the `flyout` slot makes the button a trigger, with a notch pointing
to `flyout-side`.

- Opens on mouse hover, and on click for touch, pen and keyboard.
- Stays open while a press that started inside it is held, so a slider can be
  dragged past its edge.
- Closes on pointer leave, focus leaving, Escape, or a click on an enabled
  `button`, `jolly-button` or `jolly-tool-button` inside it.
- Holds no [input layer](../interaction/input-layers.md).

## Styling

- Parts: `button`, `count`, `notch`, `tooltip`, `flyout`.
- `--jolly-tool-button-size` (`36px`), `--jolly-tool-button-gap` (`6px`).
