// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { frameBounds } from "../../../src/components/camera/orbit-fly/cameraFraming.ts";
import { createHarness } from "../../helpers/camera/orbitFlyHarness.ts";

function box(
  min: [number, number, number],
  max: [number, number, number]
): THREE.Box3 {
  return new THREE.Box3(
    new THREE.Vector3(...min),
    new THREE.Vector3(...max)
  );
}

function distanceTo(
  position: THREE.Vector3Like,
  target: THREE.Vector3
): number {
  return target.distanceTo(new THREE.Vector3().copy(position));
}

describe("frameBounds", () => {
  test("looks at the bounds' center along the forward direction, far enough to see them whole", () => {
    const bounds = box([4, -1, -1], [6, 1, 1]);
    const fov = 50;

    const pose = frameBounds(bounds, {
      forward: { x: 0, y: 0, z: -1 },
      fov
    });

    const position = new THREE.Vector3().copy(pose.position);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
      new THREE.Quaternion().copy(pose.quaternion)
    );
    const center = new THREE.Vector3(5, 0, 0);
    const radius = bounds.getBoundingSphere(new THREE.Sphere()).radius;
    const halfFov = THREE.MathUtils.degToRad(fov) / 2;
    assert.ok(forward.angleTo(center.clone().sub(position)) < 1e-6);
    assert.ok(position.distanceTo(center) * Math.sin(halfFov) >= radius);
    assert.ok(Math.abs(position.x - 5) < 1e-6 && position.z > 0);
  });

  test("keeps the distance within its bounds and frames the origin for empty bounds", () => {
    const framing = {
      forward: { x: 0, y: -0.6, z: -1 },
      fov: 60,
      minDistance: 16,
      maxDistance: 64
    };
    const origin = new THREE.Vector3();

    const empty = frameBounds(new THREE.Box3(), framing);
    const small = frameBounds(box([0, 0, 0], [2, 2, 2]), framing);
    const huge = frameBounds(box([0, 0, 0], [400, 8, 400]), framing);

    assert.ok(Math.abs(distanceTo(empty.position, origin) - 16) < 1e-6);
    assert.ok(Math.abs(distanceTo(small.position, new THREE.Vector3(1, 1, 1)) - 16) < 1e-6);
    assert.ok(Math.abs(distanceTo(huge.position, new THREE.Vector3(200, 4, 200)) - 64) < 1e-6);
  });
});

describe("OrbitFlyCamera frame", () => {
  test("leaves orbit focus and faces the bounds along its transform's forward", () => {
    const harness = createHarness({ focusMode: "lock" });
    harness.camera.enterOrbitFocus({ x: 0, y: 0, z: -5 });
    const forward = harness.camera.actor.transform.getForward(new THREE.Vector3());

    harness.camera.frame(box([-1, -1, -11], [1, 1, -9]));

    const center = new THREE.Vector3(0, 0, -10);
    const view = new THREE.Vector3(0, 0, -1).applyQuaternion(harness.orientation);
    assert.equal(harness.camera.isOrbiting, false);
    assert.ok(view.angleTo(forward) < 1e-6);
    assert.ok(view.angleTo(center.clone().sub(harness.position)) < 1e-6);
  });
});
