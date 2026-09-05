---
status: accepted
---

# A vector field's axis key is its domain identity

`jolly-vector2` takes an `axes` pair, `"xy"`, `"xz"` or `"yz"`, and the chosen key is carried
through: it is the key `value` holds, the glyph in the corner chip, the `--jolly-axis-<key>` colour
and the `data-axis` scrub target. A field sizing a box across the ground plane therefore reads as a
red X and a blue Z, and hands back `{ x, z }`.

Relabelling was rejected. `axisLabels` already overrides an axis's accessible name, and stretching it
to cover the glyph and the colour would leave a field showing Z while its value is keyed `y`. ADR-0027
has the facade write a math value component-wise by axis name, so that field would write `y` onto an
object carrying `x` and `z`, silently corrupting it. The key has to be the truth.

The pair is chosen at runtime, so `Vector2`'s value type is the union of the three two-axis records
rather than a record over `x | y | z`, which would demand all three. `VectorField` takes the value
type as a second parameter to allow that narrowing; `Vector3`, `Vector4` and `Quaternion` keep the
default derived from their constant axis set.

Switching `axes` on a mounted field moves each axis by position, `{ x: 2, y: 5 }` to `{ x: 2, z: 5 }`,
unless the new `value` already carries the new axes. A template that binds both together is the
common case and must not see its own value overwritten by the remap.

The facade dispatches a pair through `vec2PairOf`, which is exact where `isVec2Like` is not: it
answers only for a value carrying two of `x`, `y` and `z`, so `{ x, y, z }` stays a `jolly-vector3`.
Widest-first ordering in `dispatchTag` is unchanged, and the pair branch runs after it.

## Considered Options

- **Labels only, keys fixed at `x` and `y`.** Cheapest, and wrong under ADR-0027: the field writes
  the key it holds, not the letter it draws.
- **A separate `jolly-vector2-xz` element.** Three near-identical elements, three registrations and
  three API pages for one property's worth of difference.
- **An `axes` array on `VectorField`, so any field can reorder or rename.** Generalises past any
  caller: `Vector3` already names every axis it has, and per-element arity validation appears for
  nothing.
- **Remapping `value` on every `axes` change, unconditionally.** Destroys the value in the case a
  template sets the pair and its matching value in one update, which is how consumers actually
  write it.
