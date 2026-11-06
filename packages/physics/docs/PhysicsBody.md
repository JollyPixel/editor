# PhysicsBody

A rigid body in a [`PhysicsWorld`](./PhysicsWorld.md). Colliders give it a
shape and, for a dynamic body, a mass.

```ts
const platform = world.createBody({ kind: "kinematic" });
platform.attach({ shape: { type: "box", halfExtents: { x: 2, y: 0.25, z: 2 } } });

platform.moveTo({ x: 0, y: 1, z: 0 });
world.step(1 / 60);
```

## BodyDesc

```ts
type BodyKind = "dynamic" | "kinematic" | "fixed";

interface BodyDesc {
  kind: BodyKind;
  position?: Vector3Like; // default origin
  rotation?: QuaternionLike; // default identity
  linearDamping?: number; // default 0
  angularDamping?: number; // default 0
  gravityScale?: number; // default 1
  ccd?: boolean; // continuous collision detection, default false
  lockRotations?: boolean; // default false
}
```

- `dynamic`: moved by gravity, forces and contacts.
- `kinematic`: moved only by `moveTo()`, and pushes dynamic bodies out of its
  way.
- `fixed`: never moves on its own.

`BODY_DEFAULTS` holds the defaults.

## Properties

```ts
interface PhysicsBody {
  readonly kind: BodyKind;
  readonly position: Vector3Like;
  readonly rotation: QuaternionLike;
  linearVelocity: Vector3Like;
  angularVelocity: Vector3Like; // radians per second
}
```

Setting a velocity wakes the body.

## Methods

### teleport(position: Vector3Like, rotation?: QuaternionLike): void

Sets the pose at once, without sweeping through what lies between.

### moveTo(position: Vector3Like, rotation?: QuaternionLike): void

Sets the pose a kinematic body reaches at the end of the next `step()`. It has
no effect on other kinds.

### applyImpulse(impulse: Vector3Like): void

Changes the velocity by `impulse / mass` immediately.

### applyForce(force: Vector3Like): void

Applies `force` during the next `step()` only.

### attach(desc: ColliderDesc): PhysicsCollider

Adds a collider; see [`ColliderShape`](./ColliderShape.md). The body's mass is
recomputed from the colliders' densities.

### remove(): void

Removes the body and its colliders from the world. A second call does nothing;
any other member throws afterwards.

## PhysicsCollider

```ts
interface PhysicsCollider {
  readonly body: PhysicsBody;
  readonly sensor: boolean;
  detach(): void;
}
```

`detach()` removes the collider from its body. A second call does nothing.
Each collider is one object for its whole life, so it can key a `Map` or
`WeakMap`; contact events and ray hits return that same object.
