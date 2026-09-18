// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  spawnPose,
  type SpawnLayer,
  type SpawnPose
} from "../../src/scene/spawnPose.ts";

function createLayer(
  min: THREE.Vector3Like | null,
  max: THREE.Vector3Like = { x: 0, y: 0, z: 0 },
  visible = true
): SpawnLayer {
  return {
    visible,
    worldBounds: () => (min === null ?
      null :
      new THREE.Box3(
        new THREE.Vector3(min.x, min.y, min.z),
        new THREE.Vector3(max.x, max.y, max.z)
      ))
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

function distanceOf(
  pose: SpawnPose
): number {
  return pose.position.distanceTo(pose.target);
}

describe("spawnPose", () => {
  test("looks down at the grid origin when there is no layer", () => {
    const pose = spawnPose([]);

    assert.deepEqual(pose.target.toArray(), [0, 0, 0]);
    assert.ok(pose.position.y > 0);
    assert.ok(lookDirection(pose).y < 0);
    assertLooksAtTarget(pose);
  });

  test("ignores empty and hidden layers", () => {
    const pose = spawnPose([
      createLayer(null),
      createLayer({ x: 40, y: 0, z: 40 }, { x: 42, y: 2, z: 42 }, false)
    ]);

    assert.deepEqual(pose.target.toArray(), [0, 0, 0]);
  });

  test("frames the layer nearest to the world origin", () => {
    const pose = spawnPose([
      createLayer({ x: 100, y: 0, z: 100 }, { x: 104, y: 4, z: 104 }),
      createLayer({ x: 20, y: 0, z: 0 }, { x: 24, y: 4, z: 4 })
    ]);

    assert.deepEqual(pose.target.toArray(), [22, 2, 2]);
    assertLooksAtTarget(pose);
  });

  test("backs away from large layers within the distance bounds", () => {
    const small = spawnPose([
      createLayer({ x: 0, y: 0, z: 0 }, { x: 2, y: 2, z: 2 })
    ]);
    const large = spawnPose([
      createLayer({ x: 0, y: 0, z: 0 }, { x: 24, y: 8, z: 24 })
    ]);
    const huge = spawnPose([
      createLayer({ x: 0, y: 0, z: 0 }, { x: 400, y: 8, z: 400 })
    ]);

    assert.ok(Math.abs(distanceOf(small) - 16) < 1e-6);
    assert.ok(distanceOf(large) > 16);
    assert.ok(Math.abs(distanceOf(huge) - 64) < 1e-6);
  });
});
