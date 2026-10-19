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

describe("OrbitFlyCamera teleport", () => {
  test("adopts the pose position and orientation", () => {
    const harness = createHarness();
    const quaternion = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(-0.3, 1.2, 0, "YXZ")
    );

    harness.camera.teleport({
      position: { x: 4, y: 5, z: 6 },
      quaternion
    });

    assert.deepEqual(harness.position.toArray(), [4, 5, 6]);
    assert.ok(
      harness.orientation.angleTo(quaternion) < 1e-6,
      "the camera kept a different orientation"
    );
  });

  test("keeps yaw and pitch so a later frame does not snap back", () => {
    const harness = createHarness();
    const quaternion = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(-0.3, 1.2, 0, "YXZ")
    );

    harness.camera.teleport({
      position: { x: 0, y: 0, z: 0 },
      quaternion
    });
    harness.advance(5);

    assert.ok(
      harness.orientation.angleTo(quaternion) < 1e-6,
      "the camera reverted to its former orientation"
    );
  });

  test("clamps a pitch steeper than the camera allows", () => {
    const harness = createHarness();

    harness.camera.teleport({
      position: { x: 0, y: 0, z: 0 },
      quaternion: new THREE.Quaternion().setFromEuler(
        new THREE.Euler(-1.57, 0, 0, "YXZ")
      )
    });

    const pitch = new THREE.Euler()
      .setFromQuaternion(harness.orientation, "YXZ").x;
    assert.ok(
      Math.abs(pitch) <= Math.PI / 2 - 0.01 + 1e-6,
      `the pitch stayed at ${pitch}`
    );
  });

  test("drops the momentum carried into the teleport", () => {
    const harness = createHarness();

    harness.hold("KeyW");
    harness.advance(10);
    harness.hold();
    harness.camera.teleport({
      position: { x: 0, y: 0, z: 0 },
      quaternion: new THREE.Quaternion()
    });
    const settled = harness.offset.clone();
    harness.advance(10);

    assert.deepEqual(harness.offset.toArray(), settled.toArray());
  });

  test("an elastic camera stays at the pose, its pivot moved ahead at the same trail", () => {
    const harness = createHarness({
      focusMode: "elastic",
      maxPivotDistance: 20,
      position: { x: 0, y: 0, z: 0 },
      initialTrailDistance: 12
    });
    const quaternion = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(-0.3, 1.2, 0, "YXZ")
    );

    harness.camera.teleport({
      position: { x: 4, y: 5, z: 6 },
      quaternion
    });
    harness.advance(5);

    const ahead = new THREE.Vector3(0, 0, -12).applyQuaternion(quaternion).add({ x: 4, y: 5, z: 6 });
    assert.ok(harness.position.distanceTo({ x: 4, y: 5, z: 6 }) < 1e-6, "the camera went back to its pivot");
    assert.ok(ahead.distanceTo(harness.camera.orbitPivot!) < 1e-6, "the pivot did not follow the pose");
  });

  test("a locked orbit is released", () => {
    const harness = createHarness({ focusMode: "lock" });
    harness.camera.enterOrbitFocus({ x: 0, y: 0, z: -10 });

    harness.camera.teleport({
      position: { x: 4, y: 5, z: 6 },
      quaternion: new THREE.Quaternion()
    });
    harness.advance(5);

    assert.equal(harness.camera.isOrbiting, false);
    assert.deepEqual(harness.position.toArray(), [4, 5, 6]);
  });
});
