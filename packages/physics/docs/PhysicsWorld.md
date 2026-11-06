# PhysicsWorld

The simulation a backend package provides. Code written against this contract
runs on any backend.

```ts
import { RapierBackend } from "@jolly-pixel/physics.rapier";

const backend = await RapierBackend.load();
const world = backend.createWorld({ gravity: { x: 0, y: -9.81, z: 0 } });

const ball = world.createBody({ kind: "dynamic", position: { x: 0, y: 5, z: 0 } });
ball.attach({ shape: { type: "sphere", radius: 0.5 } });

world.step(1 / 60);
```

## PhysicsBackend

```ts
interface PhysicsBackend {
  readonly name: string;
  createWorld(options?: PhysicsWorldOptions): PhysicsWorld;
}

interface PhysicsWorldOptions {
  gravity?: Vector3Like; // default DEFAULT_GRAVITY, { x: 0, y: -9.81, z: 0 }
}
```

A backend loads its engine before handing out a `PhysicsBackend`, so
`createWorld()` is synchronous.

## Properties

```ts
interface PhysicsWorld {
  gravity: Vector3Like;
}
```

Reading `gravity` returns a copy.

## Methods

### createBody(desc: BodyDesc): PhysicsBody

Adds a body with no collider. See [`PhysicsBody`](./PhysicsBody.md). Throws
after `dispose()`.

### step(seconds: number): void

Advances the simulation by `seconds`. Call it with a fixed delta. Throws after
`dispose()`.

### drainContacts(listener: ContactListener): void

Calls `listener` for each contact that started or ended during the last
`step()`, then forgets them. Events not drained before the next `step()` are
dropped.

```ts
interface ContactEvent {
  started: boolean; // false when the two colliders stopped touching
  first: PhysicsCollider;
  second: PhysicsCollider;
}

type ContactListener = (event: ContactEvent) => void;
```

### castRay(ray: Ray): RayHit | null

Returns the nearest collider along the ray, or `null` when nothing is within
`maxDistance` or `direction` has zero length.

```ts
interface Ray {
  origin: Vector3Like;
  direction: Vector3Like; // need not be normalized
  maxDistance: number;
  exclude?: PhysicsBody; // its colliders are skipped
}

interface RayHit {
  collider: PhysicsCollider;
  distance: number; // from origin, in world units
  point: Vector3Like;
  normal: Vector3Like;
}
```

### dispose(): void

Frees the engine's memory. A second call does nothing.
