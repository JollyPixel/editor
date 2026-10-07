// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import {
  VoxelWorld,
  packVoxel,
  type VoxelCoord,
  type VoxelLayer
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { ConnectedCells } from "../../../src/features/placement/ConnectedCells.ts";

function layerOf(
  cells: VoxelCoord[]
): VoxelLayer {
  const world = new VoxelWorld();
  world.addLayer("Draft");
  world.setVoxelBulk("Draft", cells.map((position) => {
    return {
      position,
      blockId: 1
    };
  }));

  return world.getLayer("Draft")!;
}

function sorted(
  cells: Iterable<VoxelCoord>
): VoxelCoord[] {
  return [...cells].sort((a, b) => a.x - b.x || a.y - b.y || a.z - b.z);
}

describe("ConnectedCells", () => {
  test("collects face neighbours and skips edge and corner neighbours", () => {
    const shape = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
      { x: 2, y: 0, z: 1 },
      { x: 2, y: 0, z: 2 }
    ];
    const layer = layerOf([
      ...shape,
      { x: 0, y: 0, z: 2 },
      { x: 0, y: 1, z: 1 },
      { x: 3, y: 1, z: 3 }
    ]);

    const cells = ConnectedCells.flood(layer, { x: 2, y: 0, z: 1 })!;

    assert.equal(cells.size, 5);
    assert.deepEqual(sorted(cells), shape);
    assert.deepEqual(cells.bounds.toJSON(), {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 3, y: 1, z: 3 }
    });
  });

  test("finds nothing from an empty cell", () => {
    const layer = layerOf([{ x: 0, y: 0, z: 0 }]);

    assert.equal(ConnectedCells.flood(layer, { x: 1, y: 0, z: 0 }), null);
  });

  test("keeps the second shape of a merged cell in its template", () => {
    const layer = layerOf([{ x: 0, y: 0, z: 0 }]);
    const packed = packVoxel(2, 0);
    const partner = packVoxel(3, 1);
    layer.setPackedVoxelAt({ x: 1, y: 0, z: 0 }, packed, partner);

    const template = ConnectedCells.flood(layer, { x: 0, y: 0, z: 0 })!
      .toTemplate({
        id: "group",
        name: "Group"
      });

    assert.deepEqual(
      [...template.placedVoxels(template.pivot)].find(([x]) => x === 1),
      [1, 0, 0, packed, partner]
    );
  });
});
