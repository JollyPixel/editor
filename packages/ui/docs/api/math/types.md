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
