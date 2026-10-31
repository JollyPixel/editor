// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Internal Dependencies
import { createHarness } from "../../helpers/camera/orbitFlyHarness.ts";

describe("OrbitFlyCamera orbit event", () => {
  test("emits orbit only when the lock pivot is engaged or released", () => {
    const harness = createHarness({ focusMode: "lock", position: { x: 0, y: 0, z: 0 } });
    const changes: boolean[] = [];
    harness.camera.subscribe("orbit", (orbiting) => changes.push(orbiting));

    harness.camera.exitOrbitFocus();
    harness.camera.enterOrbitFocus({ x: 5, y: 0, z: 0 });
    harness.camera.enterOrbitFocus({ x: 0, y: 0, z: 5 });
    harness.camera.teleport({
      position: { x: 0, y: 0, z: 0 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 }
    });
    harness.camera.enterOrbitFocus({ x: 5, y: 0, z: 0 });
    harness.camera.exitOrbitFocus();

    assert.deepEqual(changes, [true, false, true, false]);
  });
});
