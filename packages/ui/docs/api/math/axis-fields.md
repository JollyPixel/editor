# Axis fields

Shared by the vector and quaternion fields:

- They implement the [shared field API](../field/shared-field-api.md).
- Each axis input follows the [`jolly-number`](../controls/number.md) entry
  rules. An axis parse error shows as the field error.
- Each axis can hold `Mixed` on its own. An edit emits the complete value.
- All but `jolly-transform` are picked by the facade's
  [`addBinding`](../facade/binding.md#control-selection).

## Axis markers

`axisStyle` (attribute `axis-style`) sets how `jolly-vector2`,
`jolly-vector3`, `jolly-vector4` and `jolly-quaternion` mark each axis:

- `"corner"`, the default: a small triangle in the axis colour on the input's
  top corner.
- `"chip"`: the axis letter in white on a square of the axis colour.
- `"letter"`: the axis letter alone, in the axis colour.

With `"chip"` and `"letter"`, dragging the letter scrubs the axis. The letter
is as wide as the control is tall; `--jolly-axis-letter-width` changes that.

New elements read their style from their class `Defaults`, so an editor can
switch every field before creating any. `Vector2`, `Vector3` and `Vector4`
share one `Defaults`; `Quaternion` has its own.

```ts
Vector3.Defaults.axisStyle = "letter";
Quaternion.Defaults.axisStyle = "letter";
```
