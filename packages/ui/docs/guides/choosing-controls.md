# Choosing controls

Use field controls for editable values:

| Value | Component |
|---|---|
| String | [`jolly-text`](../api/controls/text.md) |
| Number without a fixed range | [`jolly-number`](../api/controls/number.md) |
| Number with a fixed range | [`jolly-slider`](../api/controls/slider.md) |
| Numeric interval | [`jolly-range`](../api/controls/range.md) |
| Boolean | [`jolly-checkbox`](../api/controls/checkbox.md) |
| One choice | [`jolly-select`](../api/controls/select.md) |
| One visual choice | [`jolly-button-group`](../api/controls/button-group.md) |
| Bitmask | [`jolly-flags`](../api/controls/flags.md) |
| Hex color | [`jolly-color`](../api/controls/color.md) |

Math fields cover vectors, quaternions, transforms, and a two-dimensional pad.
They use the same controlled field contract.

Action and layout controls do not have field values. Use
[`jolly-button`](../api/controls/button.md) for commands,
[`jolly-separator`](../api/controls/separator.md) for grouping, and
[`jolly-property-row`](../api/controls/property-row.md) to align custom content
with fields.

[`jolly-controls`](../api/controls/controls.md) and
[`jolly-control`](../api/controls/control.md) render a positioned card of
keyboard or pointer hints. [`jolly-color-picker`](../api/controls/color-picker.md)
is the standalone picker used by `jolly-color`.
