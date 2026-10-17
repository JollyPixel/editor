# Math component API

- [`jolly-point2d`](./point2d.md), exported as `Point2d`
- [`jolly-quaternion`](./quaternion.md), exported as `Quaternion`
- [`jolly-transform`](./transform.md), exported as `Transform`
- [`jolly-vector2`](./vector2.md), exported as `Vector2`
- [`jolly-vector3`](./vector3.md), exported as `Vector3`
- [`jolly-vector4`](./vector4.md), exported as `Vector4`
- [Math value types](./types.md)

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

## Value helpers

### `isVec2Like`, `isVec3Like`, `isVec4Like`, `isQuatLike`, `isTransformLike`

Structural guards. Each checks only the axes it names, so a four-axis value
passes the narrower guards too.

### `parseVec2Pair(value: unknown): Vector2Pair | null`

The plane of a value with exactly two of `x`, `y` and `z`, else `null`. A
three-axis value has none.

### `snapshotComponents(value: unknown): unknown`

A plain record of the value's numeric axes, one level deep for a transform.
`Mixed` and other non-numbers are skipped.

### `copyComponents(target: unknown, source: unknown): void`

Writes `source`'s numeric axes onto `target` in place, keeping its identity.
Axes `target` does not carry are skipped.

[`formatVector`](../monitors/format.md) joins a value's axes for display.
