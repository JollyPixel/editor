# ColliderShape

The shape and material of a collider, passed to
[`PhysicsBody.attach()`](./PhysicsBody.md).
Shapes are plain data, in world units.

```ts
body.attach({
  shape: { type: "capsule", halfHeight: 0.5, radius: 0.3 },
  offset: { x: 0, y: 0.8, z: 0 },
  friction: 0.2
});
```

## Shapes

```ts
type ColliderShape =
  | { type: "box"; halfExtents: Vector3Like; }
  | { type: "sphere"; radius: number; }
  | { type: "capsule"; halfHeight: number; radius: number; } // along Y
  | { type: "trimesh"; vertices: Float32Array; indices: Uint32Array; };
```

- A capsule's total height is `2 * (halfHeight + radius)`.
- `vertices` holds `x, y, z` triples relative to the collider; `indices` holds
  three vertex indices per triangle. Use a trimesh on fixed bodies: it has no
  volume, so it gives a dynamic body no mass.

## ColliderDesc

```ts
interface ColliderDesc {
  shape: ColliderShape;
  offset?: Vector3Like; // relative to the body, default origin
  rotation?: QuaternionLike; // relative to the body, default identity
  friction?: number; // default 0.5
  restitution?: number; // bounciness, default 0
  density?: number; // default 1
  sensor?: boolean; // reports contacts without pushing back, default false
}
```

`COLLIDER_DEFAULTS` holds the material defaults.
