# Backend contract cases

The behaviour every [`PhysicsWorld`](./PhysicsWorld.md) backend must share,
written once as test cases. A backend package runs them in its own suite; the
cases use `node:assert/strict` and work with any runner.

```ts
import { describe, it } from "node:test";
import {
  BODY_LIFECYCLE_CASES,
  SIMULATION_CASES
} from "@jolly-pixel/physics/testing";

describe("MyWorld contract", () => {
  for (const { name, run } of [...BODY_LIFECYCLE_CASES, ...SIMULATION_CASES]) {
    it(name, () => {
      const world = backend.createWorld();
      try {
        run(world);
      }
      finally {
        world.dispose();
      }
    });
  }
});
```

```ts
interface PhysicsConformanceCase {
  name: string;
  run(world: PhysicsWorld): void; // throws an AssertionError on failure
}
```

Each case expects a fresh world, created with the default options.

## BODY_LIFECYCLE_CASES

Body poses, teleports, velocities, collider attachment, and what a removed
body or a disposed world rejects. They need no simulation, so a test double
of `PhysicsWorld` can run them too.

## SIMULATION_CASES

Gravity and resting contact, kinematic targets, impulses and forces, ray casts
with `exclude` and `maxDistance`, contact events and sensors. They need a real
simulation.
