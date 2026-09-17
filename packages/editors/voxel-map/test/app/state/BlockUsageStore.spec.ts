// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Third-party Dependencies
import { VoxelEngine } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  BlockUsageStore,
  WorldStore
} from "../../../src/app/state/index.ts";

function makeEngine(): VoxelEngine {
  return new VoxelEngine({
    chunkSize: 4,
    layers: ["Ground"],
    blocks: [
      {
        id: 1,
        name: "Grass",
        shapeId: "cube",
        defaultTexture: { col: 0, row: 0, tilesetId: "terrain" }
      },
      {
        id: 2,
        name: "Stone",
        shapeId: "cube"
      }
    ]
  });
}

function paint(
  engine: VoxelEngine,
  x: number
): void {
  engine.world.setVoxel("Ground", {
    position: { x, y: 0, z: 0 },
    blockId: 1
  });
}

describe("BlockUsageStore", () => {
  it("reports empty statistics until a source is attached", () => {
    const store = new BlockUsageStore(new WorldStore());

    assert.equal(store.stats.voxels, 0);
    assert.equal(store.countOf(1), 0);
    assert.equal(store.voxelsIn("Ground"), 0);
    assert.deepEqual(store.usageOf(1), {
      blockId: 1,
      voxels: 0,
      layers: []
    });
    assert.deepEqual(store.tilesetUsageOf("terrain"), {
      tilesetId: "terrain",
      blocks: [],
      voxels: 0
    });
  });

  it("reads the source synchronously when attached", () => {
    const engine = makeEngine();
    paint(engine, 0);
    const store = new BlockUsageStore(new WorldStore());
    let changes = 0;
    store.watch("change", () => changes++);

    store.attach(engine.inspector.blocks);

    assert.equal(changes, 1);
    assert.equal(store.countOf(1), 1);
    assert.equal(store.voxelsIn("Ground"), 1);
    assert.deepEqual(store.stats.unusedBlocks, [2]);
    assert.equal(store.tilesetUsageOf("terrain").voxels, 1);
  });

  it("coalesces world signals into one refresh per microtask", async() => {
    const engine = makeEngine();
    const world = new WorldStore();
    const store = new BlockUsageStore(world);
    store.attach(engine.inspector.blocks);
    let changes = 0;
    store.watch("change", () => changes++);

    for (let x = 0; x < 3; x++) {
      paint(engine, x);
      world.emit("layerUpdated", {
        action: "voxel-removed",
        layerName: "Ground",
        metadata: { position: { x, y: 0, z: 0 } }
      });
    }
    world.emit("blockRegistryChanged");
    world.emit("reset");

    assert.equal(changes, 0);
    assert.equal(store.countOf(1), 0);

    await Promise.resolve();

    assert.equal(changes, 1);
    assert.equal(store.countOf(1), 3);

    world.emit("reset");
    await Promise.resolve();
    assert.equal(changes, 2);
  });

  it("falls back to empty statistics when detached", () => {
    const engine = makeEngine();
    paint(engine, 0);
    const store = new BlockUsageStore(new WorldStore());
    store.attach(engine.inspector.blocks);

    store.attach(null);

    assert.equal(store.stats.voxels, 0);
    assert.equal(store.usageOf(1).voxels, 0);
  });
});
