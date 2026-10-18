// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  SpawnPose,
  type SpawnLayer
} from "../../../src/scene/camera/SpawnPose.ts";

function createBox(
  min: THREE.Vector3Like,
  max: THREE.Vector3Like
): THREE.Box3 {
  return new THREE.Box3(
    new THREE.Vector3(min.x, min.y, min.z),
    new THREE.Vector3(max.x, max.y, max.z)
  );
}

function createLayer(
  min: THREE.Vector3Like | null,
  max: THREE.Vector3Like = { x: 0, y: 0, z: 0 },
  visible = true
): SpawnLayer {
  return {
    visible,
    worldBounds: () => (min === null ? null : createBox(min, max))
  };
}

function lookDirection(
  pose: SpawnPose
): THREE.Vector3 {
  return new THREE.Vector3(0, 0, -1).applyQuaternion(pose.quaternion);
}

function assertLooksAtTarget(
  pose: SpawnPose
): void {
  const expected = pose.target.clone().sub(pose.position).normalize();

  assert.ok(lookDirection(pose).distanceTo(expected) < 1e-6);
}

function measureDistance(
  pose: SpawnPose
): number {
  return pose.position.distanceTo(pose.target);
}

describe("SpawnPose.nearestBounds", () => {
  test("ignores empty and hidden layers", () => {
    const bounds = SpawnPose.nearestBounds([
      createLayer(null),
      createLayer({ x: 40, y: 0, z: 40 }, { x: 42, y: 2, z: 42 }, false)
    ]);

    assert.equal(bounds, null);
  });

  test("picks the layer nearest to the world origin", () => {
    const bounds = SpawnPose.nearestBounds([
      createLayer({ x: 100, y: 0, z: 100 }, { x: 104, y: 4, z: 104 }),
      createLayer({ x: 20, y: 0, z: 0 }, { x: 24, y: 4, z: 4 })
    ]);

    assert.deepEqual(bounds?.min.toArray(), [20, 0, 0]);
  });
});

describe("SpawnPose.frame", () => {
  test("looks down at the grid origin without bounds", () => {
    const pose = SpawnPose.frame(null);

    assert.deepEqual(pose.target.toArray(), [0, 0, 0]);
    assert.ok(pose.position.y > 0);
    assert.ok(lookDirection(pose).y < 0);
    assertLooksAtTarget(pose);
  });

  test("looks at the centre of the bounds", () => {
    const pose = SpawnPose.frame(
      createBox({ x: 20, y: 0, z: 0 }, { x: 24, y: 4, z: 4 })
    );

    assert.deepEqual(pose.target.toArray(), [22, 2, 2]);
    assertLooksAtTarget(pose);
  });

  test("backs away from large bounds within the distance bounds", () => {
    const small = SpawnPose.frame(
      createBox({ x: 0, y: 0, z: 0 }, { x: 2, y: 2, z: 2 })
    );
    const large = SpawnPose.frame(
      createBox({ x: 0, y: 0, z: 0 }, { x: 24, y: 8, z: 24 })
    );
    const huge = SpawnPose.frame(
      createBox({ x: 0, y: 0, z: 0 }, { x: 400, y: 8, z: 400 })
    );

    assert.ok(Math.abs(measureDistance(small) - 16) < 1e-6);
    assert.ok(measureDistance(large) > 16);
    assert.ok(Math.abs(measureDistance(huge) - 64) < 1e-6);
  });
});
