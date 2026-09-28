// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { VoxelView } from "../../src/view/VoxelView.ts";
import { makeBlockDef } from "../helpers/blocks.ts";
import {
  makeView,
  placeCube
} from "../helpers/view.ts";
import {
  CUBE_ID as kCubeId,
  LEAVES_ID as kLeavesId
} from "../helpers/ids.ts";

function makeMeshedView(): VoxelView {
  const view = makeView({ layers: ["Ground"] });
  placeCube(view, "Ground", { x: 0, y: 0, z: 0 });
  view.tick(0);

  return view;
}

function anyChunkDirty(
  view: VoxelView
): boolean {
  return [...view.document.world.getAllChunks()].some(({ chunk }) => chunk.dirty);
}

describe("VoxelView - block order", () => {
  it("leaves the meshes untouched", () => {
    const view = makeMeshedView();
    view.document.defineBlock(makeBlockDef(kLeavesId, "cube"));
    view.tick(0);

    view.document.moveBlock(kCubeId, 1);

    assert.equal(anyChunkDirty(view), false);
  });
});
