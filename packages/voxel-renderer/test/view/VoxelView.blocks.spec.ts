// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { VoxelView } from "../../src/view/VoxelView.ts";
import { makeBlockDef } from "../helpers/blocks.ts";
import {
  chunkMeshes,
  makeView,
  placeCube
} from "../helpers/view.ts";
import { expandPulled } from "../helpers/pulledFaces.ts";
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
  it("remeshes only the chunks holding a block whose tiles change blockset", () => {
    const view = makeRowView();

    view.document.defineBlock(makeBlockDef(kCubeId, "cube", {
      defaultTexture: { col: 1, row: 0 }
    }));

    assert.deepEqual(dirtyChunkXs(view), [0]);
  });

  it("rewrites the face regions instead of remeshing when only a tile moves", () => {
    const view = makeRowView();
    view.document.defineBlock(makeBlockDef(kCubeId, "cube"));
    view.tick(0);
    const [mesh] = chunkMeshes(view).filter(
      (candidate) => candidate.name.includes("0,0,0")
    );
    const before = Array.from(expandPulled(mesh.geometry).getAttribute("uv").array);

    view.document.defineBlock(makeBlockDef(kCubeId, "cube", {
      name: "Renamed",
      defaultTexture: { col: 1, row: 0 }
    }));

    assert.equal(anyChunkDirty(view), false);
    assert.notDeepEqual(
      Array.from(expandPulled(mesh.geometry).getAttribute("uv").array),
      before
    );
  });

  it("remeshes the chunks holding a block whose tile turned", () => {
    const view = makeRowView();
    view.document.defineBlock(makeBlockDef(kCubeId, "cube"));
    view.tick(0);

    view.document.defineBlock(makeBlockDef(kCubeId, "cube", {
      defaultTexture: { col: 0, row: 0, rotation: 1 }
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

  it("leaves the meshes untouched when only the name or properties change", () => {
    const view = makeRowView();
    view.document.defineBlock(makeBlockDef(kCubeId, "cube"));
    view.tick(0);

    view.document.defineBlock(makeBlockDef(kCubeId, "cube", {
      name: "Renamed",
      properties: { hardness: 3 }
    }));

    assert.equal(anyChunkDirty(view), false);
  });

  it("remeshes the bordering chunks when a blended block only moves a tile", () => {
    const view = makeRowView();
    view.document.defineBlock(makeBlockDef(kCubeId, "cube", { blendGroup: "grass" }));
    view.tick(0);

    view.document.defineBlock(makeBlockDef(kCubeId, "cube", {
      blendGroup: "grass",
      defaultTexture: { col: 1, row: 0 }
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
