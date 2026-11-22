// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import {
  ORBIT_FLY_DEFAULT_KEYS,
  OrbitFlyKeys
} from "../../../src/components/camera/orbit-fly/OrbitFlyKeys.ts";
import {
  createHarness,
  pivotArray
} from "../../helpers/camera/orbitFlyHarness.ts";

describe("OrbitFlyKeys", () => {
  test("from drops unknown codes and keeps an empty list unbound", () => {
    const keys = OrbitFlyKeys.from({
      ...ORBIT_FLY_DEFAULT_KEYS,
      forward: ["KeyE", "NotAKey"],
      back: []
    });

    assert.deepEqual(keys.codes.forward, ["KeyE"]);
    assert.deepEqual(keys.codes.back, []);
  });

  test("keeps the default keys of an action left out", () => {
    const keys = new OrbitFlyKeys({ forward: ["KeyE"] });

    assert.deepEqual(keys.codes.left, ["KeyA", "ArrowLeft"]);
  });
});

describe("OrbitFlyCamera rebound keys", () => {
  test("flies with the rebound key and no longer with the default one", () => {
    const harness = createHarness({
      keys: new OrbitFlyKeys({ forward: ["KeyE"] })
    });

    harness.hold("KeyW");
    harness.advance(10);
    assert.equal(harness.offset.z, 0);

    harness.hold("KeyE");
    harness.advance(10);
    assert.ok(harness.offset.z < 0, "the camera did not fly forward");
  });

  test("follows keys assigned at runtime", () => {
    const harness = createHarness();

    harness.camera.keys = new OrbitFlyKeys({ up: ["KeyR"] });
    harness.hold("KeyR");
    harness.advance(10);

    assert.ok(harness.offset.y > 0, "the camera did not rise");
  });

  test("does not resume the descent on a rebound down key held through a gizmo drag", () => {
    const harness = createHarness({
      keys: new OrbitFlyKeys({ down: ["KeyC"] })
    });

    harness.camera.enabled = false;
    harness.hold("KeyC");
    harness.advance(10);

    harness.camera.enabled = true;
    harness.advance(10);

    assert.equal(harness.offset.y, 0);
  });

  test("nudges a locked pivot with the rebound keys", () => {
    const harness = createHarness({
      focusMode: "lock",
      position: { x: 0, y: 0, z: 0 },
      keys: new OrbitFlyKeys({
        forward: ["KeyE"],
        down: ["KeyC"]
      })
    });
    harness.camera.enterOrbitFocus({ x: 0, y: 0, z: -10 });

    harness.pressOnce("KeyW");
    harness.advance(60);
    assert.deepEqual(pivotArray(harness.camera.orbitPivot), [0, 0, -10]);

    harness.pressOnce("KeyE");
    harness.advance(60);
    harness.pressOnce("KeyC");
    harness.advance(60);
    assert.deepEqual(pivotArray(harness.camera.orbitPivot), [0, -1, -11]);
  });
});
