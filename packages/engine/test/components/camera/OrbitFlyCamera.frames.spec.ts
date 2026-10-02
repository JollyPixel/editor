// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import { createHarness } from "../../helpers/orbitFlyHarness.ts";

describe("OrbitFlyCamera frame requests", () => {
  test("keeps frames alive while gliding, then releases them at rest", () => {
    const harness = createHarness();
    const [keepAlive] = harness.keepAlives;
    assert.equal(keepAlive(), false);

    harness.hold("KeyW");
    harness.advance(5);
    assert.equal(keepAlive(), true);

    harness.hold();
    harness.advance(300);
    assert.equal(harness.camera.moving, false);
    assert.equal(keepAlive(), false);
  });

  test("keeps frames alive while the elastic trail damps", () => {
    const harness = createHarness({ focusMode: "elastic" });
    const [keepAlive] = harness.keepAlives;

    harness.scroll(-2);
    harness.advance();
    harness.scroll(0);
    assert.equal(keepAlive(), true);

    harness.advance(600);
    assert.equal(keepAlive(), false);
  });

  test("a disabled camera does not keep frames alive", () => {
    const harness = createHarness({ focusMode: "elastic" });
    harness.scroll(-2);
    harness.advance();
    harness.scroll(0);

    harness.camera.enabled = false;

    assert.equal(harness.keepAlives[0](), false);
  });

  test("teleport and focus changes request a frame", () => {
    const harness = createHarness({ focusMode: "lock" });
    const before = harness.invalidations();

    harness.camera.teleport({
      position: { x: 1, y: 2, z: 3 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 }
    });
    harness.camera.enterOrbitFocus({ x: 0, y: 0, z: 0 });
    harness.camera.exitOrbitFocus();

    assert.equal(harness.invalidations() - before, 3);
  });
});
