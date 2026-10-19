// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { createHarness } from "../../helpers/orbitFlyHarness.ts";

function yawPitch(
  orientation: THREE.Quaternion
): { yaw: number; pitch: number; } {
  const euler = new THREE.Euler().setFromQuaternion(orientation, "YXZ");

  return {
    yaw: euler.y,
    pitch: euler.x
  };
}

describe("OrbitFlyCamera Alt+LeftClick look", () => {
  test("rotates in free-fly, like middle-drag", () => {
    const harness = createHarness();
    const startOrientation = harness.orientation.clone();

    harness.hold("AltLeft");
    harness.lookDrag(80, 0, "left");
    harness.advance(5);
    harness.stopLookDrag();
    harness.hold();

    assert.ok(
      harness.orientation.angleTo(startOrientation) > 1e-3,
      "the camera did not rotate"
    );
  });

  test("plain LeftClick-drag (no Alt) does not rotate the camera", () => {
    const harness = createHarness();
    const startOrientation = harness.orientation.clone();

    harness.lookDrag(80, 0, "left");
    harness.advance(5);
    harness.stopLookDrag();

    assert.deepEqual(
      harness.orientation.toArray(),
      startOrientation.toArray()
    );
  });

  test("orbits around the pivot while locked, like middle-drag", () => {
    const harness = createHarness({ focusMode: "lock", position: { x: 0, y: 0, z: 0 } });
    const pivot = new THREE.Vector3(0, 0, -10);

    harness.camera.enterOrbitFocus(pivot);
    const distance = harness.position.distanceTo(pivot);

    harness.hold("AltLeft");
    harness.lookDrag(80, 0, "left");
    harness.advance(5);
    harness.stopLookDrag();
    harness.hold();

    assert.ok(
      Math.abs(harness.position.distanceTo(pivot) - distance) < 1e-3,
      "distance to the pivot drifted while orbiting"
    );
  });
});

describe("OrbitFlyCamera touchpad swipe", () => {
  test("turns the camera with the fingers instead of changing moveSpeed", () => {
    const harness = createHarness({ pitch: 0 });

    harness.swipe(-1, -1);
    harness.advance();

    const { yaw, pitch } = yawPitch(harness.orientation);
    assert.ok(Math.abs(yaw + 0.36) < 1e-6, `yaw is ${yaw}`);
    assert.ok(Math.abs(pitch - 0.36) < 1e-6, `pitch is ${pitch}`);
    assert.equal(harness.camera.moveSpeed, 18);
  });

  test("orbits the pivot instead of changing its distance while locked", () => {
    const harness = createHarness({ focusMode: "lock", position: { x: 0, y: 0, z: 0 } });
    const pivot = new THREE.Vector3(0, 0, -10);

    harness.camera.enterOrbitFocus(pivot);
    const start = harness.position.clone();
    const distance = start.distanceTo(pivot);

    harness.swipe(-1, 0);
    harness.advance(30);

    assert.ok(
      Math.abs(harness.position.distanceTo(pivot) - distance) < 1e-3,
      "the swipe changed the pivot distance"
    );
    assert.ok(
      harness.position.distanceTo(start) > 1e-3,
      "the camera did not orbit"
    );
  });

  test("leaves Ctrl+swipe to other scroll-driven interactions", () => {
    const harness = createHarness();
    const startOrientation = harness.orientation.clone();

    harness.hold("ControlLeft");
    harness.swipe(-1, -1);
    harness.advance();

    assert.deepEqual(
      harness.orientation.toArray(),
      startOrientation.toArray()
    );
  });
});

describe("OrbitFlyCamera look settings", () => {
  test("invertY turns the camera down when the fingers go up", () => {
    const harness = createHarness({ pitch: 0, invertY: true });

    harness.swipe(0, -1);
    harness.advance();

    const { pitch } = yawPitch(harness.orientation);
    assert.ok(Math.abs(pitch + 0.36) < 1e-6, `pitch is ${pitch}`);
  });

  test("a swipe pans in pan mode, keeping the orientation", () => {
    const harness = createHarness({ pitch: 0, touchpadSwipe: "pan" });
    const startOrientation = harness.orientation.clone();
    const start = harness.position.clone();

    harness.swipe(-1, -1);
    harness.advance();

    assert.deepEqual(harness.orientation.toArray(), startOrientation.toArray());
    assert.ok(harness.position.y > start.y, "the camera did not move up");
    assert.ok(
      Math.abs(harness.position.distanceTo(start) - 18 * 0.05 * Math.SQRT2) < 1e-6,
      "the camera did not move a twentieth of moveSpeed per notch"
    );
  });

  test("applies a sensitivity changed after construction", () => {
    const harness = createHarness({ pitch: 0 });
    harness.camera.touchpadLookSensitivity = 0.1;

    harness.swipe(-1, 0);
    harness.advance();

    const { yaw } = yawPitch(harness.orientation);
    assert.ok(Math.abs(yaw + 0.1) < 1e-6, `yaw is ${yaw}`);
  });
});

describe("OrbitFlyCamera keyboard look", () => {
  const cases: Array<[string, "yaw" | "pitch", number]> = [
    ["KeyL", "yaw", -1],
    ["KeyJ", "yaw", 1],
    ["KeyI", "pitch", 1],
    ["KeyK", "pitch", -1]
  ];
  for (const [code, axis, sign] of cases) {
    test(`${code} turns ${axis} at keyLookSpeed radians per second`, () => {
      const harness = createHarness({ pitch: 0, keyLookSpeed: 0.5 });

      harness.hold(code);
      harness.advance(60);

      const angle = yawPitch(harness.orientation)[axis];
      assert.ok(
        Math.abs(angle - (sign * 0.5)) < 1e-6,
        `${axis} is ${angle}`
      );
    });
  }
});
