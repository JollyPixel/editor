// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type {
  VoxelCoord,
  VoxelEngine
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { pickBlockAt } from "../../../../src/features/painting/interaction/pickBlockAt.ts";

function createEngine(
  blocks: Record<string, number>
): VoxelEngine {
  const engine = {
    world: {
      getVoxelAt(position: VoxelCoord) {
        const blockId = blocks[cellKey(position)];

        return blockId === undefined ?
          undefined :
          { blockId, transform: 0 };
      }
    }
  };

  return engine as unknown as VoxelEngine;
}

function cellKey(
  cell: VoxelCoord
): string {
  return `${cell.x},${cell.y},${cell.z}`;
}

describe("pickBlockAt", () => {
  it("reads the block of the centre cell", () => {
    const engine = createEngine({ "0,0,0": 7 });

    assert.equal(pickBlockAt(engine, { x: 0, y: 0, z: 0 }, 1), 7);
  });

  it("returns null when the footprint holds no voxel", () => {
    const engine = createEngine({ "1,0,0": 7 });

    assert.equal(pickBlockAt(engine, { x: 0, y: 0, z: 0 }, 1), null);
  });

  it("prefers the centre cell over the rest of the footprint", () => {
    const engine = createEngine({
      "0,0,0": 7,
      "-1,0,-1": 9
    });

    assert.equal(pickBlockAt(engine, { x: 0, y: 0, z: 0 }, 3), 7);
  });

  it("falls back to a neighbour when the centre is empty", () => {
    const engine = createEngine({ "1,0,1": 9 });

    assert.equal(pickBlockAt(engine, { x: 0, y: 0, z: 0 }, 3), 9);
  });

  it("stays inside the footprint", () => {
    const engine = createEngine({ "2,0,0": 9 });

    assert.equal(pickBlockAt(engine, { x: 0, y: 0, z: 0 }, 3), null);
  });

  it("only reads the aimed layer height", () => {
    const engine = createEngine({ "0,1,0": 9 });

    assert.equal(pickBlockAt(engine, { x: 0, y: 0, z: 0 }, 3), null);
  });
});
