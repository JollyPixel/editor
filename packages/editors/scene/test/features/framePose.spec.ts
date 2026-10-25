// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { framePose } from "../../src/features/viewport/framePose.ts";

describe("framePose", () => {
  test("looks at the bounds' center along the given direction from far enough to see them whole", () => {
    const bounds = new THREE.Box3(
      new THREE.Vector3(4, -1, -1),
      new THREE.Vector3(6, 1, 1)
    );
    const fov = 50;

    const pose = framePose(bounds, { x: 0, y: 0, z: -1 }, fov);

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
});
