// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";
import { VoxelTransform } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  mirrorOf,
  quarterTurnOf
} from "../../../src/features/placement/gizmoTransforms.ts";

function offsetUnder(
  options: ReturnType<typeof quarterTurnOf>,
  offset: THREE.Vector3
): number[] {
  const transform = VoxelTransform.fromPacked(VoxelTransform.pack(options));
  const { x, y, z } = transform.transformOffset(offset);

  return [x, y, z].map((value) => value + 0);
}

describe("gizmoTransforms", () => {
  for (const turns of [1, -1] as const) {
    test(`a ${turns} turn of the arc turns voxels the way the arc sweeps`, () => {
      const offset = new THREE.Vector3(2, 0, 1);
      const swept = offset
        .clone()
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), turns * Math.PI / 2)
        .round();

      assert.deepEqual(
        offsetUnder(quarterTurnOf(turns), offset),
        swept.toArray().map((value) => value + 0)
      );
    });
  }

  for (const axis of ["x", "y", "z"] as const) {
    test(`a ${axis} chip mirrors voxels along ${axis} only`, () => {
      const offset = new THREE.Vector3(2, 3, 1);
      const mirrored = offset.clone();
      mirrored[axis] = -mirrored[axis];

      assert.deepEqual(
        offsetUnder(mirrorOf(axis), offset),
        mirrored.toArray()
      );
    });
  }
});
