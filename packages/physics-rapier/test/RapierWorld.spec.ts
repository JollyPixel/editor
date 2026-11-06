// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { PhysicsWorld } from "@jolly-pixel/physics";
import {
  BODY_LIFECYCLE_CASES,
  SIMULATION_CASES
} from "@jolly-pixel/physics/testing";

// Import Internal Dependencies
import { RapierBackend } from "#src/RapierBackend.ts";

class AccessorQuaternion {
  #values: [number, number, number, number];

  constructor(
    x: number,
    y: number,
    z: number,
    w: number
  ) {
    this.#values = [x, y, z, w];
  }

  get x() {
    return this.#values[0];
  }

  get y() {
    return this.#values[1];
  }

  get z() {
    return this.#values[2];
  }

  get w() {
    return this.#values[3];
  }
}

async function createWorld(): Promise<PhysicsWorld> {
  const backend = await RapierBackend.load();

  return backend.createWorld();
}

describe("RapierWorld contract", () => {
  for (const { name, run } of [...BODY_LIFECYCLE_CASES, ...SIMULATION_CASES]) {
    it(name, async() => {
      const world = await createWorld();
      try {
        run(world);
      }
      finally {
        world.dispose();
      }
    });
  }
});

describe("RapierWorld", () => {
  it("accepts a rotation whose components are accessors", async() => {
    const world = await createWorld();
    const box = world.createBody({
      kind: "dynamic",
      position: { x: 0, y: 5, z: 0 },
      rotation: new AccessorQuaternion(0, 0, 0, 1)
    });
    box.attach({
      shape: { type: "sphere", radius: 0.5 },
      rotation: new AccessorQuaternion(0, 0, 0, 1)
    });

    for (let index = 0; index < 10; index++) {
      world.step(1 / 60);
    }

    assert.ok(box.position.y < 5, `y = ${box.position.y}`);
    world.dispose();
  });
});
