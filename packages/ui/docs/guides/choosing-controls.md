# Choosing controls

Pick a field element by the value it edits. Every field follows the
[shared field API](../api/field/shared-field-api.md).

- String: [`jolly-text`](../api/controls/text.md).
- Number without a fixed range: [`jolly-number`](../api/controls/number.md).
- Number with a fixed range: [`jolly-slider`](../api/controls/slider.md), or
  [`jolly-spin-slider`](../api/controls/spin-slider.md) in a narrow column.
- Numeric interval: [`jolly-range`](../api/controls/range.md).
- Boolean: [`jolly-checkbox`](../api/controls/checkbox.md), or
  [`jolly-toggle`](../api/controls/toggle.md) with the label inside the control.
- One choice: [`jolly-select`](../api/controls/select.md), or
  [`jolly-button-group`](../api/controls/button-group.md) to show every option.
- Bitmask with a few named bits: [`jolly-flags`](../api/controls/flags.md).
- Layer mask, or one index out of up to 32:
  [`jolly-layer-grid`](../api/controls/layer-grid.md).
- Hex colour: [`jolly-color`](../api/controls/color.md).
- Vectors, quaternions, transforms and a 2D pad: the
  [math fields](../api/math/README.md).

## Not fields

- Commands: [`jolly-button`](../api/controls/button.md).
- Grouping: [`jolly-separator`](../api/controls/separator.md).
- Custom content aligned with fields:
  [`jolly-property-row`](../api/controls/property-row.md).
- Keyboard or pointer hint cards: [`jolly-controls`](../api/controls/controls.md)
  and [`jolly-control`](../api/controls/control.md).
- The standalone colour picker behind `jolly-color`:
  [`jolly-color-picker`](../api/controls/color-picker.md).
