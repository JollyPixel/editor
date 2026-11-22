# quat

```ts
import { quat } from "@jolly-pixel/math";

const turn = quat.loadEuler(quat.create(), { x: 0, y: Math.PI / 2, z: 0 });
quat.multiply(orientation, turn, orientation);
quat.slerp(orientation, orientation, target, 0.25);
```

Quaternions are `[x, y, z, w]`. Every function below writes into `out` and
returns it.

## Creation and conversion

### `create(): Quat`

The identity rotation `[0, 0, 0, 1]`.

### `copy(out, a): Quat`

### `load(out, value: Readonly<QuaternionLike>): Quat`

### `write<T extends QuaternionLike>(out: T, a): T`

### `loadEuler(out, euler: Readonly<EulerLike>): Quat`

Euler angles in radians, applied in XYZ order (the three.js default).

### `writeEuler<T extends EulerLike>(out: T, q): T`

XYZ Euler angles of the unit quaternion `q`. When `y` is at ±90° (gimbal lock),
the whole rotation goes on `x` and `z` is 0.

## Operations

### `multiply(out, a, b): Quat`

`a * b`: the rotation `b` followed by `a`.

### `invert(out, a): Quat`

Works on non-unit quaternions. A zero quaternion stays zero.

### `slerp(out, a, b, alpha): Quat`

Spherical interpolation along the shortest arc. When `a` and `b` are almost
equal, it interpolates linearly and normalizes the result.

### `lookAt(out, eye, target, up): Quat`

The orientation whose `-z` axis points from `eye` to `target`, like three.js
`Matrix4.lookAt`. It falls back like three.js when `eye` equals `target` or
the view direction is parallel to `up`.
