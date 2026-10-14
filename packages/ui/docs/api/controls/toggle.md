# `jolly-toggle`

`jolly-toggle` edits a boolean value and implements the
[shared field API](../field/shared-field-api.md). It draws `label` inside a
filled box with a small on/off switch at the box's end, so the whole box is
the control. Use it where a label column next to a lone
[`jolly-checkbox`](./checkbox.md) looks out of place, such as a row of
toggles sharing one line.

```html
<jolly-toggle label="Cast shadows"></jolly-toggle>
```

## Layout

The field has no label column and always reflects `unlabeled`. The box fills
the value area, and the label truncates when the box is too narrow, showing
its full text on hover. The revert button, the description button and peer
chips sit before the box, as on any unlabeled field.

The box fills whatever width the host gets. To put several toggles on one
line, place them in a flex container and give each host `flex: 1 1 0`.

## Properties

### `value`

`boolean | typeof Mixed`. Defaults to `false`. A mixed value centres the knob.

## Interaction

A native checkbox inside the box carries focus, the Space key and the
accessible name, which is `label`. Clicking anywhere in the box toggles it.
Activating a mixed value commits `true`. User activation emits `jolly-change`.

A read-only or locked toggle ignores clicks and stays in the tab order. A
disabled toggle cannot be focused.

`colored` paints the switch track with the accent fill instead of the neutral
active color.

## Facade

A boolean binding with `view: "toggle"` builds this element instead of a
`jolly-checkbox`.

```ts
pane.addBinding(light, "castShadow", {
  label: "Cast shadows",
  view: "toggle"
});
```
