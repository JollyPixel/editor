// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import {
  packVoxel,
  VoxelTemplate,
  type VoxelCoord,
  type VoxelTemplateBounds
} from "../../../../src/document/world/index.ts";
import { VoxelTransform } from "../../../../src/document/geometry/index.ts";

// CONSTANTS
const kPosition: VoxelCoord = {
  x: 10,
  y: 2,
  z: -4
};

function lShapedTemplate(
  pivot?: VoxelCoord
): VoxelTemplate {
  return new VoxelTemplate({
    id: "l",
    name: "L",
    ...pivot === undefined ? {} : { pivot },
    positions: [
      0, 0, 0,
      1, 0, 0,
      2, 0, 0,
      0, 1, 0,
      0, 0, 1
    ],
    voxels: Array.from({ length: 5 }, () => packVoxel(1, 0))
  });
}

function boundsOfPlaced(
  template: VoxelTemplate,
  transform: VoxelTransform
): VoxelTemplateBounds {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const cell of template.placedVoxels(kPosition, transform)) {
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], cell[axis]);
      max[axis] = Math.max(max[axis], cell[axis]);
    }
  }

  return {
    min: {
      x: min[0],
      y: min[1],
      z: min[2]
    },
    size: {
      x: max[0] - min[0] + 1,
      y: max[1] - min[1] + 1,
      z: max[2] - min[2] + 1
    }
  };
}

function allTransforms(): VoxelTransform[] {
  return Array.from(
    { length: 32 },
    (_, packed) => VoxelTransform.fromPacked(packed)
  );
}

describe("VoxelTemplate.placedBounds", () => {
  test("puts the default bottom-center pivot on the position", () => {
    assert.deepEqual(lShapedTemplate().placedBounds(kPosition), {
      min: {
        x: 9,
        y: 2,
        z: -5
      },
      size: {
        x: 3,
        y: 2,
        z: 2
      }
    });
  });

  test("covers exactly the placed voxels for every transform", () => {
    for (const pivot of [undefined, { x: 2, y: 1, z: 1 }]) {
      const template = lShapedTemplate(pivot);
      for (const transform of allTransforms()) {
        assert.deepEqual(
          template.placedBounds(kPosition, transform),
          boundsOfPlaced(template, transform),
          `transform ${transform.packed}`
        );
      }
    }
  });
});

describe("VoxelTemplate.placedPositionFor", () => {
  test("inverts placedBounds for every transform", () => {
    const template = lShapedTemplate({ x: 1, y: 0, z: 1 });
    for (const transform of allTransforms()) {
      const { min } = template.placedBounds(kPosition, transform);

      assert.deepEqual(template.placedPositionFor(min, transform), kPosition);
    }
  });
});
