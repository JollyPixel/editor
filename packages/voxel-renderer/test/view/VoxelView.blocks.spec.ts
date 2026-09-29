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

function dirtyChunkXs(
  view: VoxelView
): number[] {
  return [...view.document.world.getAllChunks()]
    .filter(({ chunk }) => chunk.dirty)
    .map(({ chunk }) => chunk.cx)
    .sort((left, right) => left - right);
}

function makeRowView(): VoxelView {
  const view = makeView({ layers: ["Ground"] });
  view.document.defineBlock(makeBlockDef(kLeavesId, "cube"));
  placeCube(view, "Ground", { x: 0, y: 0, z: 0 });
  placeCube(view, "Ground", { x: 4, y: 0, z: 0 }, kLeavesId);
  placeCube(view, "Ground", { x: 12, y: 0, z: 0 }, kLeavesId);
  view.tick(0);

  return view;
}

describe("VoxelView - block redefinition", () => {
  it("remeshes only the chunks holding a block whose texture moved", () => {
    const view = makeRowView();

    view.document.defineBlock(makeBlockDef(kCubeId, "cube", {
      defaultTexture: { col: 1, row: 0 }
    }));

    assert.deepEqual(dirtyChunkXs(view), [0]);
  });

  it("remeshes the bordering chunks when the block stops occluding", () => {
    const view = makeRowView();

    view.document.defineBlock(makeBlockDef(kCubeId, "cube", {
      alphaMode: "mask"
    }));

    assert.deepEqual(dirtyChunkXs(view), [0, 1]);
  });

  it("leaves the meshes untouched for a block no voxel uses", () => {
    const view = makeRowView();

    view.document.defineBlock(makeBlockDef(9, "cube"));

    assert.equal(anyChunkDirty(view), false);
  });

  it("remeshes the bordering chunks when a block is removed", () => {
    const view = makeRowView();

    view.document.removeBlock(kLeavesId);

    assert.deepEqual(dirtyChunkXs(view), [0, 1, 3]);
  });
});
