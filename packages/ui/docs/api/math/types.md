# Math value types

The math fields take structural values and do not depend on Three.js: a
`THREE.Vector3` is a `Vec3Like`, a `THREE.Quaternion` a `QuatLike`.

```ts
interface Vec2Like { readonly x: number; readonly y: number; }
interface Vec3Like { readonly x: number; readonly y: number; readonly z: number; }
interface Vec4Like { readonly x: number; readonly y: number; readonly z: number; readonly w: number; }
interface QuatLike { readonly x: number; readonly y: number; readonly z: number; readonly w: number; }

interface TransformLike {
  readonly position: Vec3Like;
  readonly rotation: QuatLike;
  readonly scale: Vec3Like;
}

// A concrete record, a record of per-axis field values, or Mixed.
type VectorValue<TAxis extends string> =
  | Record<TAxis, number>
  | Record<TAxis, FieldValue<number>>
  | typeof Mixed;

type Vector2Pair = "xy" | "xz" | "yz";
type AxisStyle = "corner" | "chip" | "letter";
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
