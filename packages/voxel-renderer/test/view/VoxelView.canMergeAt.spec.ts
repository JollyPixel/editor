// Import Node.js Dependencies
import {
  afterEach,
  describe,
  it
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { VoxelView } from "../../src/view/VoxelView.ts";
import { VoxelTransform } from "../../src/document/geometry/index.ts";
import { makeBlockDef } from "../helpers/blocks.ts";
import { makeView } from "../helpers/view.ts";

// CONSTANTS
const kLayer = "Ground";
const kStair = 1;
const kSlabBeam = 2;
const kSlabBottom = 3;
const kCell = {
  x: 0,
  y: 0,
  z: 0
};
const kUpsideDown = VoxelTransform.pack({ flipY: true });
const kViews = new Set<VoxelView>();

function makeStairView(): VoxelView {
  const view = makeView({
    layers: [kLayer],
    blocks: [
      makeBlockDef(kStair, "stair"),
      makeBlockDef(kSlabBeam, "slabBeam"),
      makeBlockDef(kSlabBottom, "slabBottom")
    ]
  });
  view.document.world.setVoxel(kLayer, { position: kCell, blockId: kStair });
  kViews.add(view);

  return view;
}

describe("VoxelView.canMergeAt", () => {
  afterEach(() => {
    for (const view of kViews) {
      view.dispose();
    }
    kViews.clear();
  });

  it("accepts the shape that fills the rest of the cell", () => {
    const view = makeStairView();

    assert.equal(
      view.canMergeAt(kLayer, kCell, { blockId: kSlabBeam, transform: kUpsideDown }),
      true
    );
  });

  it("refuses a shape that overlaps or leaves a gap", () => {
    const view = makeStairView();

    assert.equal(
      view.canMergeAt(kLayer, kCell, { blockId: kSlabBeam, transform: 0 }),
      false
    );
    assert.equal(
      view.canMergeAt(kLayer, kCell, { blockId: kSlabBottom, transform: kUpsideDown }),
      false
    );
  });

  it("refuses an empty cell and a cell that is already merged", () => {
    const view = makeStairView();
    const part = { blockId: kSlabBeam, transform: kUpsideDown };

    assert.equal(view.canMergeAt(kLayer, { x: 1, y: 0, z: 0 }, part), false);
    view.document.world.setVoxel(kLayer, {
      position: kCell,
      blockId: kSlabBeam,
      flipY: true,
      merge: true
    });
    assert.equal(view.canMergeAt(kLayer, kCell, part), false);
  });
});
