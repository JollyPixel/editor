# mat4

```ts
import { mat4 } from "@jolly-pixel/math";

const local = mat4.compose(mat4.create(), position, orientation, scale);
const world = mat4.multiply(mat4.create(), parentWorld, local);
mat4.decompose(world, position, orientation, scale);
```

Matrices are column-major, the layout of three.js `Matrix4.elements`.

## Creation

### `create(): Mat4`

A new identity matrix.

### `identity(out): Mat4`

### `copy(out, value: Readonly<ArrayLike<number>>): Mat4`

Copies the first 16 numbers of `value`, such as a three.js
`Matrix4.elements` or a matrix read from a transform.

## Operations

### `multiply(out, a, b): Mat4`

`a * b`: `b` is applied first.

### `invert(out, a): Mat4`

When `a` is singular, `out` is filled with zeros, like three.js
`Matrix4.invert`.

### `compose(out, position, quaternion, scale): Mat4`

The matrix that scales, then rotates, then translates, like three.js
`Matrix4.compose`.

### `decompose(m, position, quaternion, scale): void`

Splits `m` into the three tuples, like three.js `Matrix4.decompose`. Unlike
the other functions, it reads `m` first and writes into the tuples that
follow it. A mirrored matrix gets a negative x scale, so `compose` rebuilds
`m`. Non-uniform scale is supported; shear is not.

### `extractTranslation(out: Vec3, m): Vec3`
