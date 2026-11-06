// Import Node.js Dependencies
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { PhysicsBody } from "../PhysicsBody.ts";
import type {
  ContactEvent,
  PhysicsWorld
} from "../PhysicsWorld.ts";
import type { Vector3Like } from "../vectors.ts";

// CONSTANTS
const kStep = 1 / 60;
const kZeroGravity = {
  x: 0,
  y: 0,
  z: 0
};
const kHalfTurnY = {
  x: 0,
  y: 1,
  z: 0,
  w: 0
};
const kSphere = {
  shape: {
    type: "sphere",
    radius: 0.5
  }
} as const;
const kDownFromAbove = {
  origin: {
    x: 0,
    y: 10,
    z: 0
  },
  direction: {
    x: 0,
    y: -1,
    z: 0
  },
  maxDistance: 100
};

export interface PhysicsConformanceCase {
  name: string;
  run(world: PhysicsWorld): void;
}

export const BODY_LIFECYCLE_CASES: readonly PhysicsConformanceCase[] = [
  {
    name: "creates a body at its description pose, or at the origin",
    run(world) {
      const placed = world.createBody({
        kind: "kinematic",
        position: { x: 1, y: 2, z: 3 },
        rotation: kHalfTurnY
      });
      const origin = world.createBody({ kind: "fixed" });

      assert.equal(placed.kind, "kinematic");
      assert.deepEqual(placed.position, { x: 1, y: 2, z: 3 });
      assert.deepEqual(placed.rotation, kHalfTurnY);
      assert.deepEqual(origin.position, { x: 0, y: 0, z: 0 });
      assert.deepEqual(origin.rotation, { x: 0, y: 0, z: 0, w: 1 });
    }
  },
  {
    name: "teleports a body, keeping its rotation when none is given",
    run(world) {
      const body = world.createBody({ kind: "dynamic" });

      body.teleport({ x: 5, y: 0, z: 0 }, kHalfTurnY);
      body.teleport({ x: 6, y: 0, z: 0 });

      assert.deepEqual(body.position, { x: 6, y: 0, z: 0 });
      assert.deepEqual(body.rotation, kHalfTurnY);
    }
  },
  {
    name: "reads back the velocities it was given",
    run(world) {
      const body = world.createBody({ kind: "dynamic" });
      body.attach(kSphere);

      body.linearVelocity = { x: 0, y: 0, z: -3 };
      body.angularVelocity = { x: 0, y: 1, z: 0 };

      assert.deepEqual(body.linearVelocity, { x: 0, y: 0, z: -3 });
      assert.deepEqual(body.angularVelocity, { x: 0, y: 1, z: 0 });
    }
  },
  {
    name: "attaches colliders that know their body and sensor flag",
    run(world) {
      const body = world.createBody({ kind: "fixed" });

      const solid = body.attach(kSphere);
      const sensor = body.attach({
        ...kSphere,
        sensor: true
      });

      assert.equal(solid.body, body);
      assert.equal(solid.sensor, false);
      assert.equal(sensor.sensor, true);
    }
  },
  {
    name: "rejects a removed body but ignores a second removal",
    run(world) {
      const body = world.createBody({ kind: "dynamic" });

      body.remove();
      body.remove();

      assert.throws(() => body.position);
      assert.throws(() => body.attach(kSphere));
      assert.throws(() => body.applyImpulse({ x: 1, y: 0, z: 0 }));
    }
  },
  {
    name: "rejects new bodies and steps once disposed",
    run(world) {
      world.dispose();
      world.dispose();

      assert.throws(() => world.createBody({ kind: "fixed" }));
      assert.throws(() => world.step(kStep));
    }
  }
];

export const SIMULATION_CASES: readonly PhysicsConformanceCase[] = [
  {
    name: "drops a dynamic box onto fixed ground where it comes to rest",
    run(world) {
      addGround(world);
      const box = addUnitBox(world, { x: 0, y: 3, z: 0 });

      runSteps(world, 180);

      assertNear(box.position.y, 0.5, 0.02);
      assertNear(box.linearVelocity.y, 0, 0.01);
    }
  },
  {
    name: "moves a kinematic body to its target on the next step",
    run(world) {
      const platform = world.createBody({ kind: "kinematic" });

      platform.moveTo({ x: 1, y: 2, z: 3 });
      assert.deepEqual(platform.position, { x: 0, y: 0, z: 0 });
      world.step(kStep);

      assertNear(platform.position.x, 1, 1e-3);
      assertNear(platform.position.y, 2, 1e-3);
      assertNear(platform.position.z, 3, 1e-3);
    }
  },
  {
    name: "changes velocity by impulse divided by mass",
    run(world) {
      world.gravity = kZeroGravity;
      const box = addUnitBox(world, { x: 0, y: 0, z: 0 });

      box.applyImpulse({ x: 2, y: 0, z: 0 });

      assertNear(box.linearVelocity.x, 2, 1e-6);
    }
  },
  {
    name: "applies a force during the next step only",
    run(world) {
      world.gravity = kZeroGravity;
      const box = addUnitBox(world, { x: 0, y: 0, z: 0 });

      box.applyForce({ x: 60, y: 0, z: 0 });
      world.step(kStep);
      const afterFirstStep = box.linearVelocity.x;
      world.step(kStep);

      assertNear(afterFirstStep, 1, 1e-4);
      assert.equal(box.linearVelocity.x, afterFirstStep);
    }
  },
  {
    name: "applies gravity scale and a changed world gravity",
    run(world) {
      world.gravity = kZeroGravity;
      const floating = world.createBody({
        kind: "dynamic",
        gravityScale: 0
      });
      floating.attach(kSphere);
      const falling = addUnitBox(world, { x: 5, y: 0, z: 0 });

      world.gravity = { x: 0, y: -10, z: 0 };
      runSteps(world, 10);

      assert.deepEqual(world.gravity, { x: 0, y: -10, z: 0 });
      assert.equal(floating.position.y, 0);
      assert.ok(falling.position.y < 0, `y = ${falling.position.y}`);
    }
  },
  {
    name: "casts a ray to the nearest hit with its distance, point and normal",
    run(world) {
      world.gravity = kZeroGravity;
      addGround(world);
      const box = addUnitBox(world, { x: 0, y: 2, z: 0 });
      world.step(kStep);

      const hit = world.castRay({
        ...kDownFromAbove,
        direction: { x: 0, y: -2, z: 0 }
      });

      assert.ok(hit !== null);
      assert.equal(hit.collider.body, box);
      assertNear(hit.distance, 7.5, 1e-4);
      assertNear(hit.point.y, 2.5, 1e-4);
      assertNear(hit.normal.y, 1, 1e-4);
    }
  },
  {
    name: "casts a ray past the excluded body",
    run(world) {
      world.gravity = kZeroGravity;
      const ground = addGround(world);
      const box = addUnitBox(world, { x: 0, y: 2, z: 0 });
      world.step(kStep);

      const hit = world.castRay({
        ...kDownFromAbove,
        exclude: box
      });

      assert.equal(hit?.collider.body, ground);
    }
  },
  {
    name: "casts no hit past the max distance or for a zero direction",
    run(world) {
      addGround(world);
      world.step(kStep);

      assert.equal(world.castRay({
        ...kDownFromAbove,
        maxDistance: 5
      }), null);
      assert.equal(world.castRay({
        ...kDownFromAbove,
        direction: { x: 0, y: 0, z: 0 }
      }), null);
    }
  },
  {
    name: "no longer hits a detached collider or a removed body",
    run(world) {
      const anchor = world.createBody({ kind: "fixed" });
      const collider = anchor.attach(kSphere);
      const box = addUnitBox(world, { x: 3, y: 0, z: 0 });
      world.step(kStep);

      collider.detach();
      collider.detach();
      box.remove();
      world.step(kStep);

      assert.equal(world.castRay(kDownFromAbove), null);
      assert.equal(world.castRay({
        ...kDownFromAbove,
        origin: { x: 3, y: 10, z: 0 }
      }), null);
    }
  },
  {
    name: "reports a started contact on landing, and an ended one on leaving",
    run(world) {
      const ground = addGround(world);
      const box = addUnitBox(world, { x: 0, y: 1, z: 0 });
      const events: ContactEvent[] = [];

      for (let index = 0; index < 60; index++) {
        world.step(kStep);
        world.drainContacts((event) => events.push(event));
      }
      box.teleport({ x: 0, y: 20, z: 0 });
      world.step(kStep);
      world.drainContacts((event) => events.push(event));

      assert.deepEqual(
        events.map(({ started, first, second }) => [
          started,
          new Set([first.body, second.body])
        ]),
        [
          [true, new Set([ground, box])],
          [false, new Set([ground, box])]
        ]
      );
    }
  },
  {
    name: "lets a body fall through a sensor while reporting the contact",
    run(world) {
      const trigger = world.createBody({ kind: "fixed" });
      const sensor = trigger.attach({
        shape: {
          type: "box",
          halfExtents: { x: 5, y: 0.1, z: 5 }
        },
        sensor: true
      });
      const box = addUnitBox(world, { x: 0, y: 1, z: 0 });
      const touched: boolean[] = [];

      for (let index = 0; index < 60; index++) {
        world.step(kStep);
        world.drainContacts((event) => {
          if (event.first === sensor || event.second === sensor) {
            touched.push(event.started);
          }
        });
      }

      assert.deepEqual(touched, [true, false]);
      assert.ok(box.position.y < -1, `y = ${box.position.y}`);
    }
  }
];

function addGround(
  world: PhysicsWorld
): PhysicsBody {
  const ground = world.createBody({ kind: "fixed" });
  ground.attach({
    shape: {
      type: "box",
      halfExtents: { x: 10, y: 0.5, z: 10 }
    },
    offset: { x: 0, y: -0.5, z: 0 }
  });

  return ground;
}

function addUnitBox(
  world: PhysicsWorld,
  position: Vector3Like
): PhysicsBody {
  const body = world.createBody({
    kind: "dynamic",
    position
  });
  body.attach({
    shape: {
      type: "box",
      halfExtents: { x: 0.5, y: 0.5, z: 0.5 }
    }
  });

  return body;
}

function runSteps(
  world: PhysicsWorld,
  steps: number
): void {
  for (let index = 0; index < steps; index++) {
    world.step(kStep);
  }
}

function assertNear(
  actual: number,
  expected: number,
  tolerance: number
): void {
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}
