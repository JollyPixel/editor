---
status: accepted
---

# Structural math types, no `three` dependency

`Vec2Like`, `Vec3Like`, `QuatLike` and `TransformLike` are read-only structural interfaces.
`THREE.Vector3` and `THREE.Quaternion` satisfy them already, so 3D editors pass `mesh.position` and
`mesh.quaternion` directly, while a 2D consumer of a button or a colour swatch never pulls a 3D
library. `THREE.Object3D` is not itself `TransformLike`; a one-line adapter is expected at the call
site.

Values are immutable snapshots, because Lit re-renders on assignment and mutating in place does not
repaint. Properties declare `hasChanged` with a component-wise comparison so re-assigning an
equal-valued object does not repaint either.

Vector fields apply `Mixed` per axis rather than whole-value, so their `value` is a union
(`Record<TAxis, number> | Record<TAxis, FieldValue<number>> | typeof Mixed`). The plain record is
the common direct-binding case; the per-axis form only appears under multi-selection.

## Considered Options

- **Depending on `three` for math types.** A 2D colour swatch would transitively pull a 3D engine.
- **Scrubbing a mixed field from a synthesised start.** The first pointer move collapses the whole
  selection onto a value the user never saw, in one undo step. Mixed disables gestures that need a
  starting value; typing stays available.
