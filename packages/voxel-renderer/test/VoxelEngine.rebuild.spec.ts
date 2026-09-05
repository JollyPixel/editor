// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  fillChunks,
  makeEngine,
  CUBE_ID as kCubeId
} from "./helpers/engine.ts";

describe("VoxelEngine — chunk rebuild orchestration", () => {
  it("tick() builds a mesh for a dirty chunk and adds it to root", () => {
    const engine = makeEngine();
    engine.world.addLayer("Ground");
    engine.world.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: kCubeId });

    engine.tick(0);

    assert.equal(engine.root.children.length, 1);
  });

  it("tick() does not rebuild a chunk that isn't dirty", () => {
    const engine = makeEngine();
    engine.world.addLayer("Ground");
    engine.world.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: kCubeId });
    engine.tick(0);
    const meshCountAfterFirstTick = engine.root.children.length;

    engine.tick(0);

    assert.equal(engine.root.children.length, meshCountAfterFirstTick);
  });

  it("init() rebuilds meshes for voxels already present before initialization (e.g. after deserialize)", () => {
    const engine = makeEngine();
    engine.world.addLayer("Ground");
    engine.world.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: kCubeId });

    engine.init();

    assert.equal(engine.root.children.length, 1);
  });

  it("dispose() removes all chunk meshes from root", () => {
    const engine = makeEngine();
    engine.world.addLayer("Ground");
    engine.world.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: kCubeId });
    engine.tick(0);
    assert.equal(engine.root.children.length, 1);

    engine.dispose();

    assert.equal(engine.root.children.length, 0);
  });
});

/**
 * Budget exhaustion, queue resumption and focus ordering are ChunkRebuildQueue
 * policy, covered in render/ChunkRebuildQueue.spec.ts. What is left here is the
 * engine wiring around it.
 */
describe("VoxelEngine — rebuild queue wiring", () => {
  it("flush() ignores the budget", () => {
    const engine = makeEngine({ rebuildBudgetMs: Number.MIN_VALUE });
    engine.world.addLayer("Ground");
    fillChunks(engine, "Ground", 6);

    engine.flush();

    assert.equal(engine.pendingRebuilds, 0);
    assert.equal(engine.root.children.length, 6);
  });

  it("keeps an edit that lands after the flag is cleared", () => {
    const engine = makeEngine();
    engine.world.addLayer("Ground");
    engine.world.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: kCubeId });
    engine.tick(0);

    // The chunk was meshed, so a further edit must dirty it again rather than
    // being swallowed by the clear that ran before the mesh.
    engine.world.setVoxel("Ground", { position: { x: 1, y: 0, z: 0 }, blockId: kCubeId });

    assert.equal(engine.world.getLayer("Ground")!.getChunk(0, 0, 0)!.dirty, true);
  });

  it("builds the whole world from init(), nearest the focus first", () => {
    const engine = makeEngine();
    engine.world.addLayer("Ground");
    fillChunks(engine, "Ground", 4);
    engine.focus = { x: 14, y: 2, z: 2 };

    engine.init();

    assert.deepEqual(
      engine.root.children.map((mesh) => mesh.name.split(":")[1]),
      ["3,0,0", "2,0,0", "1,0,0", "0,0,0"]
    );
    assert.equal(engine.pendingRebuilds, 0);
  });

  it("does not rebuild a chunk unloaded while it was queued", () => {
    const engine = makeEngine({ rebuildBudgetMs: Number.MIN_VALUE });
    engine.world.addLayer("Ground");
    fillChunks(engine, "Ground", 3);
    engine.tick(0);
    assert.equal(engine.pendingRebuilds, 2);

    // Emptying a chunk drops it from the layer; the queue must let it go too.
    engine.world.removeVoxel("Ground", { position: { x: 4, y: 0, z: 0 } });
    engine.world.removeVoxel("Ground", { position: { x: 8, y: 0, z: 0 } });
    engine.flush();

    assert.equal(engine.pendingRebuilds, 0);
    assert.equal(engine.root.children.length, 1);
  });
});
