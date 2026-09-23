// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { VoxelEngine } from "../src/VoxelEngine.ts";
import type { VoxelEngineOptions } from "../src/VoxelEngine.types.ts";
import {
  chunkCoordsOf,
  chunkMeshes,
  fillChunks,
  makeEngine,
  placeCube
} from "./helpers/engine.ts";

function makeGroundEngine(
  options: VoxelEngineOptions = {}
): VoxelEngine {
  return makeEngine({ layers: ["Ground"], ...options });
}

function withOneCube(): VoxelEngine {
  const engine = makeGroundEngine();
  placeCube(engine, "Ground", { x: 0, y: 0, z: 0 });

  return engine;
}

describe("VoxelEngine - chunk rebuild orchestration", () => {
  it("tick() meshes a dirty chunk once", () => {
    const engine = withOneCube();

    engine.tick(0);
    const [mesh] = chunkMeshes(engine);
    engine.tick(0);

    assert.deepEqual(chunkMeshes(engine), [mesh]);
  });

  it("init() meshes voxels already present before initialization", () => {
    const engine = withOneCube();

    engine.init();

    assert.equal(chunkMeshes(engine).length, 1);
  });

  it("dispose() removes all chunk meshes from root", () => {
    const engine = withOneCube();
    engine.tick(0);

    engine.dispose();

    assert.equal(engine.root.children.length, 0);
  });

  it("flush() ignores the budget", () => {
    const engine = makeGroundEngine({ rebuildBudgetMs: Number.MIN_VALUE });
    fillChunks(engine, "Ground", 6);

    engine.flush();

    assert.equal(engine.pendingRebuilds, 0);
    assert.equal(chunkMeshes(engine).length, 6);
  });

  it("keeps an edit that lands after the flag is cleared", () => {
    const engine = withOneCube();
    engine.tick(0);

    placeCube(engine, "Ground", { x: 1, y: 0, z: 0 });

    assert.equal(engine.world.getLayer("Ground")!.getChunk(0, 0, 0)!.dirty, true);
  });

  it("builds the whole world from init(), nearest the focus first", () => {
    const engine = makeGroundEngine();
    fillChunks(engine, "Ground", 4);
    engine.focus = { x: 14, y: 2, z: 2 };

    engine.init();

    assert.deepEqual(
      chunkMeshes(engine).map(chunkCoordsOf),
      ["3,0,0", "2,0,0", "1,0,0", "0,0,0"]
    );
    assert.equal(engine.pendingRebuilds, 0);
  });

  it("does not rebuild a chunk unloaded while it was queued", () => {
    const engine = makeGroundEngine({ rebuildBudgetMs: Number.MIN_VALUE });
    fillChunks(engine, "Ground", 3);
    engine.tick(0);
    assert.equal(engine.pendingRebuilds, 2);

    engine.world.removeVoxel("Ground", { position: { x: 4, y: 0, z: 0 } });
    engine.world.removeVoxel("Ground", { position: { x: 8, y: 0, z: 0 } });
    engine.flush();

    assert.equal(engine.pendingRebuilds, 0);
    assert.equal(chunkMeshes(engine).length, 1);
  });

  it("whenIdle() resolves at once when nothing is left to mesh", async() => {
    const engine = makeGroundEngine();

    await engine.whenIdle();
  });

  it("whenIdle() waits for a dirty chunk that is not queued yet", async() => {
    const engine = withOneCube();
    let idle = false;
    const pending = engine.whenIdle().then(() => {
      idle = true;
    });

    await Promise.resolve();
    assert.equal(engine.pendingRebuilds, 0);
    assert.equal(idle, false);

    engine.tick(0);
    await pending;
    assert.equal(chunkMeshes(engine).length, 1);
  });

  it("whenIdle() resolves once the budgeted queue drains", async() => {
    const engine = makeGroundEngine({ rebuildBudgetMs: Number.MIN_VALUE });
    fillChunks(engine, "Ground", 3);
    let idle = false;
    const pending = engine.whenIdle().then(() => {
      idle = true;
    });

    engine.tick(0);
    await Promise.resolve();
    assert.ok(engine.pendingRebuilds > 0);
    assert.equal(idle, false);

    while (engine.pendingRebuilds > 0) {
      engine.tick(0);
    }
    await pending;
    assert.equal(chunkMeshes(engine).length, 3);
  });
});
