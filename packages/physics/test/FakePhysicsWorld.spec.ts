// Import Node.js Dependencies
import { describe, it } from "node:test";

// Import Internal Dependencies
import { BODY_LIFECYCLE_CASES } from "#src/testing/index.ts";
import { FakePhysicsWorld } from "./helpers/fakePhysics.ts";

describe("FakePhysicsWorld body lifecycle contract", () => {
  for (const { name, run } of BODY_LIFECYCLE_CASES) {
    it(name, () => {
      run(new FakePhysicsWorld());
    });
  }
});
