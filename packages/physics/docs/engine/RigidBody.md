# RigidBody

An actor component that owns a [`PhysicsBody`](../PhysicsBody.md) and its
colliders. A `fixed` one with a box collider is a wall; a `dynamic` one is a
crate that falls.

```ts
import { RigidBody } from "@jolly-pixel/physics/engine";

world.createActor("ground").addComponent(RigidBody, {
  kind: "fixed",
  colliders: [
    { shape: { type: "box", halfExtents: { x: 10, y: 0.5, z: 10 } } }
  ]
});

const crate = world.createActor("crate");
crate.object3D.position.set(0, 5, 0);
crate.addComponentAndGet(RigidBody, { linearDamping: 0.5 })
  .body.applyImpulse({ x: 0, y: 4, z: 0 });
```

## Options

```ts
interface RigidBodySettings {
  kind: BodyKind; // default "dynamic"
  linearDamping: number; // default 0
  angularDamping: number; // default 0
  gravityScale: number; // default 1
  ccd: boolean; // default false
  lockRotations: boolean; // default false
  colliders: ColliderSettings[]; // default one unit box
}

interface ColliderSettings {
  shape: ColliderShape; // default { type: "box", halfExtents: 0.5 on each axis }
  offset: Vector3Like; // in the actor's local space, default origin
  friction: number; // default 0.5
  restitution: number; // default 0
  density: number; // default 1
  sensor: boolean; // default false
}
```

Every field is optional, and so is every field of each collider.
`RIGID_BODY_DEFAULTS` and `COLLIDER_SETTINGS_DEFAULTS` hold the defaults. Pass
`colliders: []` for a body with no collider. See
[`ColliderShape`](../ColliderShape.md) for the shapes. Throws when the world has
no [`PhysicsSystem`](./PhysicsSystem.md).

## Properties

```ts
class RigidBody {
  readonly settings: Readonly<RigidBodySettings>;
  readonly body: PhysicsBody;
  readonly colliders: readonly PhysicsCollider[]; // in settings order
  readonly contacts: SignalEvent<[contact: ActorContact]>;
}
```

`contacts` fires when one of its colliders starts or stops touching another;
[`PhysicsSystem`](./PhysicsSystem.md) documents `ActorContact`.

```ts
const coin = world.createActor("coin").addComponentAndGet(RigidBody, {
  kind: "fixed",
  colliders: [{ shape: { type: "sphere", radius: 0.3 }, sensor: true }]
});

coin.contacts.connect(({ started, actor }) => {
  if (started && actor?.name === "player") {
    coin.actor.markDestructionPending();
  }
});
```

## Methods

### teleport(position: Vector3Like, rotation?: QuaternionLike): void

Moves the body and its actor at once, with no interpolation from the previous
pose. `rotation` defaults to the current one.

## Behaviour

- The body starts at the actor's world position and rotation.
- Collider shapes and offsets are scaled by the actor's world scale when the
  component is added: a box per axis, a sphere by the largest axis, a
  capsule's radius by X and Z and its height by Y. Later scale changes are
  ignored.
- `dynamic`: the body drives the actor. Each frame the actor is placed between
  the poses of the last two steps. Read `body.position` in `fixedUpdate()` for
  the simulated pose.
- `kinematic`: the actor drives the body. Move the actor; the body follows on
  the next step.
- `fixed`: neither moves after creation.
- Destroying the component removes the body and its colliders.

## Scene files

`RigidBodyDefinition` registers the component under the type `"RigidBody"`. It
builds nothing in edit mode, and saves box, sphere and capsule colliders; it
does not own a `RigidBody` with a trimesh collider.

```ts
import { RigidBodyDefinition } from "@jolly-pixel/physics/engine";

definitions.register(new RigidBodyDefinition());
```

```ts
interface RigidBodyData {
  kind: BodyKind;
  linearDamping: number;
  angularDamping: number;
  gravityScale: number;
  ccd: boolean;
  lockRotations: boolean;
  colliders: ColliderData[]; // missing: one unit box
}

interface ColliderData {
  shape: "box" | "sphere" | "capsule"; // default "box"
  halfExtents: Vector3Like; // box
  radius: number; // sphere and capsule, default 0.5
  halfHeight: number; // capsule, default 0.5
  offset: Vector3Like;
  friction: number;
  restitution: number;
  density: number;
  sensor: boolean;
}
```

A missing or invalid field takes its default. Entries of `colliders` that are
not objects are skipped.
