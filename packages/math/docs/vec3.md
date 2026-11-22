# vec3

```ts
import { vec3 } from "@jolly-pixel/math";

const offset = vec3.create(0, 0, -1);
vec3.transformQuat(offset, offset, orientation);
vec3.add(position, position, offset);
```

Every function below except `create`, `squaredLength` and `distance` writes
into `out` and returns it.

## Creation and conversion

### `create(x = 0, y = 0, z = 0): Vec3`

### `copy(out, a): Vec3`

### `load(out, value: Readonly<Vector3Like>): Vec3`

Reads an `{ x, y, z }` object into a tuple.

### `write<T extends Vector3Like>(out: T, a): T`

Writes a tuple into an `{ x, y, z }` object, such as a three.js `Vector3`, and
returns that object.

## Arithmetic

### `add(out, a, b): Vec3`

### `subtract(out, a, b): Vec3`

`a - b`.

### `scale(out, a, factor): Vec3`

### `cross(out, a, b): Vec3`

### `normalize(out, a): Vec3`

A zero vector stays zero.

### `lerp(out, a, b, alpha): Vec3`

`alpha` is not clamped.

### `squaredLength(a): number`

### `distance(a, b): number`

## Transformation

### `transformQuat(out, a, q): Vec3`

Rotates `a` by the quaternion `q`, like three.js `Vector3.applyQuaternion`.

### `transformMat4(out, a, m): Vec3`

Transforms the point `a` by `m` with the perspective divide, like three.js
`Vector3.applyMatrix4`. When `w` is zero the divide is skipped.
