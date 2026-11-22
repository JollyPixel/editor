# Types

## Tuples

```ts
type Vec3 = [x: number, y: number, z: number];
type Quat = [x: number, y: number, z: number, w: number];
type Mat4 = [
  m11: number, m21: number, m31: number, m41: number,
  m12: number, m22: number, m32: number, m42: number,
  m13: number, m23: number, m33: number, m43: number,
  m14: number, m24: number, m34: number, m44: number
];
```

- Tuples are plain arrays, never typed arrays.
- `Mat4` is column-major, the layout of three.js `Matrix4.elements`: the
  translation sits at indices 12, 13 and 14.
- Quaternions put `w` last.

## Shapes

```ts
interface Vector3Like { x: number; y: number; z: number; }
interface QuaternionLike { x: number; y: number; z: number; w: number; }
interface EulerLike { x: number; y: number; z: number; }
```

Object shapes for public APIs. A three.js `Vector3`, `Quaternion` or `Euler`
matches them. Convert at the boundary with `vec3.load`/`vec3.write` and
`quat.load`/`quat.write`.
