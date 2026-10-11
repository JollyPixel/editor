// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import type { VoxelCoord } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { firstCellAlong } from "../../../../src/features/painting/interaction/firstCellAlong.ts";

function scanCells(
  ...cells: VoxelCoord[]
): (cell: VoxelCoord) => boolean {
  const keys = new Set(cells.map(({ x, y, z }) => `${x},${y},${z}`));

  return ({ x, y, z }) => keys.has(`${x},${y},${z}`);
}

describe("firstCellAlong", () => {
  test("returns the nearest matching cell the ray crosses", () => {
    const ray = {
      origin: { x: 0.5, y: 5.5, z: 0.5 },
      direction: { x: Math.SQRT1_2, y: -Math.SQRT1_2, z: 0 }
    };

    assert.deepStrictEqual(
      firstCellAlong(
        ray,
        10,
        scanCells({ x: 4, y: 1, z: 0 }, { x: 2, y: 3, z: 0 })
      ),
      { x: 2, y: 3, z: 0 }
    );
  });

  test("walks rays running against every axis", () => {
    const ray = {
      origin: { x: -0.5, y: -0.5, z: -0.5 },
      direction: { x: -1, y: 0, z: 0 }
    };

    assert.deepStrictEqual(
      firstCellAlong(ray, 10, scanCells({ x: -4, y: -1, z: -1 })),
      { x: -4, y: -1, z: -1 }
    );
  });

  test("ignores cells past the distance it may travel", () => {
    const ray = {
      origin: { x: 0.5, y: 0.5, z: 0.5 },
      direction: { x: 0, y: 0, z: 1 }
    };
    const far = scanCells({ x: 0, y: 0, z: 6 });

    assert.strictEqual(firstCellAlong(ray, 5, far), null);
    assert.deepStrictEqual(firstCellAlong(ray, 6, far), { x: 0, y: 0, z: 6 });
  });
});
