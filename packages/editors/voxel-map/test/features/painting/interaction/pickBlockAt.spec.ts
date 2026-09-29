// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type {
  VoxelCoord,
  VoxelView
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { pickBlockAt } from "../../../../src/features/painting/interaction/pickBlockAt.ts";
import {
  BrushFootprint,
  type BrushFootprintOptions
} from "../../../../src/features/painting/model/BrushFootprint.ts";

function footprint(
  size: number,
  patch: Partial<BrushFootprintOptions> = {}
): BrushFootprint {
  return new BrushFootprint({
    position: { x: 0, y: 0, z: 0 },
    size,
    axis: "xz",
    pattern: "square",
    ...patch
  });
}

function createView(
  blocks: Record<string, number>
): VoxelView {
  const view = {
    document: {
      world: {
        getVoxelAt(position: VoxelCoord) {
          const blockId = blocks[cellKey(position)];

          return blockId === undefined ?
            undefined :
            { blockId, transform: 0 };
        }
      }
    }
  };

  return view as unknown as VoxelView;
}

function cellKey(
  cell: VoxelCoord
): string {
  return `${cell.x},${cell.y},${cell.z}`;
}

describe("pickBlockAt", () => {
  it("reads the block of the centre cell", () => {
    const view = createView({ "0,0,0": 7 });

    assert.equal(pickBlockAt(view, footprint(1)), 7);
  });

  it("returns null when the footprint holds no voxel", () => {
    const view = createView({ "1,0,0": 7 });

    assert.equal(pickBlockAt(view, footprint(1)), null);
  });

  it("prefers the centre cell over the rest of the footprint", () => {
    const view = createView({
      "0,0,0": 7,
      "-1,0,-1": 9
    });

    assert.equal(pickBlockAt(view, footprint(3)), 7);
  });

  it("falls back to a neighbour when the centre is empty", () => {
    const view = createView({ "1,0,1": 9 });

    assert.equal(pickBlockAt(view, footprint(3)), 9);
  });

  it("stays inside the footprint", () => {
    const view = createView({ "2,0,0": 9 });

    assert.equal(pickBlockAt(view, footprint(3)), null);
  });

  it("only reads the aimed layer height", () => {
    const view = createView({ "0,1,0": 9 });

    assert.equal(pickBlockAt(view, footprint(3)), null);
  });

  it("reads the whole footprint of a vertical brush", () => {
    const view = createView({ "0,2,0": 9 });

    assert.equal(pickBlockAt(view, footprint(3, { axis: "xy" })), 9);
  });

  it("skips the corners a circle leaves out", () => {
    const view = createView({ "-2,0,-2": 9 });

    assert.equal(pickBlockAt(view, footprint(4)), 9);
    assert.equal(pickBlockAt(view, footprint(4, { pattern: "circle" })), null);
  });
});
