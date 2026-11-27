# @jolly-pixel/math

Vector, quaternion and matrix math on plain number tuples

## 💃 Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm][npm] or [yarn][yarn].

```bash
$ npm i @jolly-pixel/math
# or
$ yarn add @jolly-pixel/math
```

## 👀 Usage example

```ts
import {
  mat4,
  quat,
  vec3
} from "@jolly-pixel/math";

const position = vec3.create(0, 2, 5);
const orientation = quat.lookAt(
  quat.create(),
  position,
  vec3.create(0, 0, 0),
  vec3.create(0, 1, 0)
);
const world = mat4.compose(
  mat4.create(),
  position,
  orientation,
  vec3.create(1, 1, 1)
);

const point = vec3.transformMat4(vec3.create(), [0, 0, -1], world);
```

Every function that returns a tuple writes it into its first argument `out`
and returns `out`, so hot paths reuse scratch tuples instead of allocating.
`out` may be one of the inputs.

## 📚 API

- [Types](./docs/types.md): `Vec3`, `Quat`, `Mat4` and the `{ x, y, z }` shapes
- [vec3](./docs/vec3.md): arithmetic, rotation and transformation of 3D vectors
- [quat](./docs/quat.md): rotations, Euler angles, `slerp`, `lookAt`
- [mat4](./docs/mat4.md): `compose`, `decompose`, `multiply`, `invert`
- [Scalars](./docs/scalar.md): `clamp`, `DEGREES_TO_RADIANS`, `RADIANS_TO_DEGREES`

## ✨ Contributors guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

Once you have finished your development, check that the tests (and linter) are still good by running the following script:

```bash
$ pnpm run test
$ pnpm run lint
```

The tests compare each operation with three.js on seeded random inputs.
`bench/transform.bench.ts` times the operations the ECS transform calls every
frame; run it with `node bench/transform.bench.ts`.

> [!CAUTION]
> In case you introduce a new feature or fix a bug, make sure to include tests for it as well.

## 📃 License

MIT

<!-- Reference-style links for DRYness -->

[npm]: https://docs.npmjs.com/getting-started/what-is-npm
[yarn]: https://yarnpkg.com
[contributing]: ../../CONTRIBUTING.md
