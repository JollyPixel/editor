# Math component API

- [`jolly-point2d`](./point2d.md), exported as `Point2d`
- [`jolly-quaternion`](./quaternion.md), exported as `Quaternion`
- [`jolly-transform`](./transform.md), exported as `Transform`
- [`jolly-vector2`](./vector2.md), exported as `Vector2`
- [`jolly-vector3`](./vector3.md), exported as `Vector3`
- [`jolly-vector4`](./vector4.md), exported as `Vector4`
- [Math value types](./types.md)

Vector and quaternion components implement the
[shared field API](../field/shared-field-api.md).

Every one of them except `jolly-transform` is reachable from the facade:
`addBinding` picks one from the bound value's own axes. See
[Binding facade](../facade/binding.md).

## Value helpers

The root entry point exports the structural guards these components dispatch
on, and the functions the facade uses to move axes between a field and a bound
object:

- `isVec2Like(value)`, `isVec3Like(value)`, `isVec4Like(value)`,
  `isQuatLike(value)`, `isTransformLike(value)`. Each asks only for the axes it
  names, so a four-axis value satisfies the narrower guards too.
- `vec2PairOf(value)` names the plane of a value carrying exactly two of `x`,
  `y` and `z` (`"xy"`, `"xz"` or `"yz"`), and returns null for anything else.
  It is exact where the guards above are not: a three-axis value belongs to
  `jolly-vector3`, not to a pair.
- `snapshotComponents(value)` returns a plain record of a value's own numeric
  axes, one level deep for a transform. Non-numeric axes, `Mixed` among them,
  are skipped.
- `copyComponents(target, source)` writes `source`'s numeric axes onto `target`
  in place, keeping `target`'s identity. Axes `target` does not already carry
  are left out.
- `formatVector(value, precision?)` joins the axes a value carries into
  `x, y, z`, rounded to `precision` decimals (default `2`) with trailing zeros
  dropped.
