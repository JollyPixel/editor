# `jolly-toggle`

`jolly-toggle` edits a boolean. It draws `label` inside a filled box with a
small switch at its end, and the whole box is the control. It implements the
[shared field API](../field/shared-field-api.md).

```html
<jolly-toggle label="Cast shadows"></jolly-toggle>
```

Use it where a label column next to a lone [`jolly-checkbox`](./checkbox.md)
looks out of place, such as several toggles on one line.

## Properties

```ts
interface Toggle {
  value: boolean | typeof Mixed; // default false, Mixed centres the knob
}
```

## Layout

- No label column: the field always reflects `unlabeled`. The label truncates
  inside the box.
- Revert, description and peer chips sit before the box.
- The box fills the host. For one line of toggles, use a flex container and
  `flex: 1 1 0` on each.
- `colored` paints the track with the accent fill.

## Interaction

- An inner native checkbox carries focus, Space and the accessible name.
- A click anywhere in the box toggles. A `Mixed` value commits `true`.
- Activation emits `jolly-change`.
- Read-only or locked: ignores clicks, stays focusable. Disabled: not
  focusable.

## Facade

`view: "toggle"` on a boolean binding builds this element.
