# Math value types

The math components use structural values and do not depend on Three.js.

- `Vec3Like` has numeric `x`, `y`, and `z` properties.
- `QuatLike` has numeric `x`, `y`, `z`, and `w` properties.
- `TransformLike` groups position, quaternion rotation, and scale values.
- `VectorValue<TAxis>` permits a concrete numeric record or per-axis field
  values.

Objects with matching properties can be assigned directly. A `THREE.Vector3`
matches `Vec3Like`; a `THREE.Quaternion` matches `QuatLike`.
