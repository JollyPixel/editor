# PhysicsSystem

Binds a [`PhysicsWorld`](../PhysicsWorld.md) to an engine `World` and steps it
on every fixed update. [`RigidBody`](./RigidBody.md) needs one on its world.

```ts
import { PhysicsSystem } from "@jolly-pixel/physics/engine";
import { RapierBackend } from "@jolly-pixel/physics.rapier";

const backend = await RapierBackend.load();
const physicsSystem = PhysicsSystem.attach(runtime.world, backend);
```

## Properties

```ts
class PhysicsSystem {
  readonly physics: PhysicsWorld;
}
```

## Methods

### static attach(world: World, backend: PhysicsBackend, options?: PhysicsWorldOptions): PhysicsSystem

Creates `physics` with `backend.createWorld(options)` and attaches the system
to `world`. The system owns `physics` and disposes it in `dispose()`. Throws
when `world` already has a system, before anything is created. Attach it
before loading a scene that holds physics components.

### static require(world: World): PhysicsSystem

Returns the system of `world`. Throws when it has none.

### castRay(ray: Ray): ActorRayHit | null

`PhysicsWorld.castRay()`, plus the actor that owns the body that was hit.

```ts
interface ActorRayHit extends RayHit {
  actor: Actor | null; // null for a body created through `physics`
}
```

### ownedBodies(actor: Actor, onContact?: ActorContactListener)

Returns a `Pick<PhysicsWorld, "createBody">` whose bodies belong to `actor`:
ray hits and contacts on them name `actor`, and `onContact` receives their
contacts.
[`RigidBody`](./RigidBody.md) creates its body this way. Pass it to code that
only needs `createBody()`, such as the voxel renderer's `PhysicsVoxelCollider`,
so hits on the terrain name the map actor.

```ts
const map = world.createActor("map");
const terrain = physicsSystem.ownedBodies(map);
```

```ts
interface ActorContact {
  started: boolean; // false when the two colliders stopped touching
  collider: PhysicsCollider; // the owner's collider
  other: PhysicsCollider;
  actor: Actor | null; // owner of `other`, null when nobody owns its body
}

type ActorContactListener = (contact: ActorContact) => void;
```

### observeSteps(observer: PhysicsStepObserver): () => void

Runs `beforeStep` and `afterStep` around every physics step. Returns the
function that stops observing.

```ts
interface PhysicsStepObserver {
  beforeStep?(): void;
  afterStep?(): void;
}
```

### dispose(): void

Stops stepping, detaches the system from its world and disposes the physics
world.

## Step order

Each fixed step of the engine `World` runs:

1. the components' `fixedUpdate()`, where scripts apply forces and impulses;
2. `beforeStep` observers: kinematic bodies take their actor's pose;
3. `physics.step(fixedDelta)`;
4. `afterStep` observers: dynamic bodies record their new pose;
5. contact events, delivered to the `onContact` of each body's owner, such as
   `RigidBody.contacts`.

Rendering then interpolates dynamic actors between their last two poses.
