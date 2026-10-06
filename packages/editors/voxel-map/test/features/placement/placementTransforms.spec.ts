// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";
import {
  VoxelTransform,
  type VoxelTransformOptions
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  PLACEMENT_MIRRORS,
  PLACEMENT_ROTATIONS
} from "../../../src/features/placement/placementTransforms.ts";

function offsetUnder(
  options: VoxelTransformOptions,
  offset: THREE.Vector3
): number[] {
  const transform = VoxelTransform.fromPacked(VoxelTransform.pack(options));
  const { x, y, z } = transform.transformOffset(offset);

  return [x, y, z].map((value) => value + 0);
}

describe("placementTransforms", () => {
  for (const rotation of PLACEMENT_ROTATIONS) {
    test(`"${rotation.title}" turns voxels the way a ${rotation.turns} arc sweeps`, () => {
      const offset = new THREE.Vector3(2, 0, 1);
      const swept = offset
        .clone()
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation.turns * Math.PI / 2)
        .round();

      assert.deepEqual(
        offsetUnder(rotation.transform, offset),
        swept.toArray().map((value) => value + 0)
      );
    });
  }

  test("covers both arc directions once", () => {
    assert.deepEqual(
      PLACEMENT_ROTATIONS.map((rotation) => rotation.turns).sort(),
      [-1, 1]
    );
  });

  for (const mirror of PLACEMENT_MIRRORS) {
    test(`"${mirror.title}" mirrors voxels along ${mirror.axis} only`, () => {
      const offset = new THREE.Vector3(2, 3, 1);
      const mirrored = offset.clone();
      mirrored[mirror.axis] = -mirrored[mirror.axis];

      assert.deepEqual(
        offsetUnder(mirror.transform, offset),
        mirrored.toArray()
      );
    });
  }
});
