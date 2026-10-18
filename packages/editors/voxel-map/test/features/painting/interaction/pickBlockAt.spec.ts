// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  VoxelLayerVisibility,
  VoxelWorld,
  type VoxelView
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
    pattern: "square",
    ...patch
  });
}

function createView(
  blocks: Record<string, number>,
  layerVisibility = new VoxelLayerVisibility()
): VoxelView {
  const world = new VoxelWorld();
  world.addLayer("Ground");
  for (const [key, blockId] of Object.entries(blocks)) {
    const [x, y, z] = key.split(",").map(Number);
    world.setVoxel("Ground", {
      position: { x, y, z },
      blockId
    });
  }
  const view = {
    document: { world },
    layerVisibility
  };

  return view as unknown as VoxelView;
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

  it("skips the corners a circle leaves out", () => {
    const view = createView({ "-2,0,-2": 9 });

    assert.equal(pickBlockAt(view, footprint(4)), 9);
    assert.equal(pickBlockAt(view, footprint(4, { pattern: "circle" })), null);
  });

  it("reads only the layers the view draws, saved-hidden ones included", () => {
    const layerVisibility = new VoxelLayerVisibility();
    const view = createView({ "0,0,0": 7 }, layerVisibility);
    const { world } = view.document;
    world.addLayer("Draft", { visible: false });
    world.setVoxel("Draft", {
      position: { x: 0, y: 0, z: 0 },
      blockId: 3
    });

    assert.equal(pickBlockAt(view, footprint(1)), 7);

    layerVisibility.override("Ground", false);
    layerVisibility.override("Draft", true);

    assert.equal(pickBlockAt(view, footprint(1)), 3);
  });
});
