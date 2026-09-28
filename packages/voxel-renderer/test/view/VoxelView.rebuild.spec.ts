// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { VoxelView } from "../../src/view/VoxelView.ts";
import {
  chunkCoordsOf,
  chunkMeshes,
  fillChunks,
  makeView,
  placeCube,
  type ViewTestOptions
} from "../helpers/view.ts";

function makeGroundView(
  options: ViewTestOptions = {}
): VoxelView {
  return makeView({ layers: ["Ground"], ...options });
}

function withOneCube(): VoxelView {
  const view = makeGroundView();
  placeCube(view, "Ground", { x: 0, y: 0, z: 0 });

  return view;
}

describe("VoxelView - chunk rebuild orchestration", () => {
  it("tick() meshes a dirty chunk once", () => {
    const view = withOneCube();

    view.tick(0);
    const [mesh] = chunkMeshes(view);
    view.tick(0);

    assert.deepEqual(chunkMeshes(view), [mesh]);
  });

  it("init() meshes voxels already present before initialization", () => {
    const view = withOneCube();

    view.init();

    assert.equal(chunkMeshes(view).length, 1);
  });

  it("dispose() removes all chunk meshes from root", () => {
    const view = withOneCube();
    view.tick(0);

    view.dispose();

    assert.equal(chunkMeshes(view).length, 0);
  });

  it("flush() ignores the budget", () => {
    const view = makeGroundView({ meshing: { budgetMs: Number.MIN_VALUE } });
    fillChunks(view, "Ground", 6);

    view.flush();

    assert.equal(view.pendingRebuilds, 0);
    assert.equal(chunkMeshes(view).length, 6);
  });

  it("builds the whole world from init(), nearest the focus first", () => {
    const view = makeGroundView();
    fillChunks(view, "Ground", 4);
    view.focus = { x: 14, y: 2, z: 2 };

    view.init();

    assert.deepEqual(
      chunkMeshes(view).map(chunkCoordsOf),
      ["3,0,0", "2,0,0", "1,0,0", "0,0,0"]
    );
    assert.equal(view.pendingRebuilds, 0);
  });

  it("does not rebuild a chunk unloaded while it was queued", () => {
    const view = makeGroundView({ meshing: { budgetMs: Number.MIN_VALUE } });
    fillChunks(view, "Ground", 3);
    view.tick(0);
    assert.equal(view.pendingRebuilds, 2);

    view.document.world.removeVoxel("Ground", { position: { x: 4, y: 0, z: 0 } });
    view.document.world.removeVoxel("Ground", { position: { x: 8, y: 0, z: 0 } });
    view.flush();

    assert.equal(view.pendingRebuilds, 0);
    assert.equal(chunkMeshes(view).length, 1);
  });

  it("whenIdle() resolves at once when nothing is left to mesh", async() => {
    const view = makeGroundView();

    await view.whenIdle();
  });

  it("whenIdle() waits for a dirty chunk that is not queued yet", async() => {
    const view = withOneCube();
    let idle = false;
    const pending = view.whenIdle().then(() => {
      idle = true;
    });

    await Promise.resolve();
    assert.equal(view.pendingRebuilds, 0);
    assert.equal(idle, false);

    view.tick(0);
    await pending;
    assert.equal(chunkMeshes(view).length, 1);
  });

  it("whenIdle() resolves once the budgeted queue drains", async() => {
    const view = makeGroundView({ meshing: { budgetMs: Number.MIN_VALUE } });
    fillChunks(view, "Ground", 3);
    let idle = false;
    const pending = view.whenIdle().then(() => {
      idle = true;
    });

    view.tick(0);
    await Promise.resolve();
    assert.ok(view.pendingRebuilds > 0);
    assert.equal(idle, false);

    while (view.pendingRebuilds > 0) {
      view.tick(0);
    }
    await pending;
    assert.equal(chunkMeshes(view).length, 3);
  });
});
