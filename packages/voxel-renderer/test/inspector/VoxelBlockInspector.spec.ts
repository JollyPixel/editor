// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelEngine } from "../../src/VoxelEngine.ts";
import { makeBlockDef } from "../helpers/blocks.ts";

// CONSTANTS
const kGrass = 1;
const kStone = 2;
const kUnused = 3;
const kDeleted = 9;

function makeEngine(): VoxelEngine {
  const engine = new VoxelEngine({
    chunkSize: 4,
    layers: ["Ground", "Top", "Empty"],
    blocks: [
      makeBlockDef(kGrass, "cube", {
        defaultTexture: { col: 0, row: 0, tilesetId: "terrain" }
      }),
      makeBlockDef(kStone, "cube", {
        defaultTexture: { col: 1, row: 0, tilesetId: "terrain" },
        faceTextures: {
          top: { col: 0, row: 0, tilesetId: "props" }
        }
      }),
      makeBlockDef(kUnused, "cube", {
        defaultTexture: { col: 2, row: 0, tilesetId: "props" }
      }),
      makeBlockDef(kDeleted, "cube")
    ]
  });

  const { world } = engine;
  for (let x = 0; x < 5; x++) {
    world.setVoxel("Ground", {
      position: { x, y: 0, z: 0 },
      blockId: kGrass
    });
  }
  world.setVoxel("Top", {
    position: { x: 0, y: 1, z: 0 },
    blockId: kStone
  });
  world.setVoxel("Top", {
    position: { x: 1, y: 1, z: 0 },
    blockId: kDeleted
  });
  engine.blockRegistry.unregister(kDeleted);

  return engine;
}

describe("VoxelBlockInspector", () => {
  it("reports empty statistics for an empty world", () => {
    const engine = new VoxelEngine({
      blocks: [makeBlockDef(kGrass, "cube")]
    });

    assert.deepEqual(engine.inspector.blocks.stats, {
      voxels: 0,
      layers: [],
      blocks: new Map(),
      unusedBlocks: [kGrass],
      orphanBlocks: [],
      orphanVoxels: 0
    });
  });

  it("aggregates voxels per layer and per block", () => {
    const { stats } = makeEngine().inspector.blocks;

    assert.equal(stats.voxels, 7);
    assert.deepEqual(
      [...stats.layers].sort((a, b) => a.layerName.localeCompare(b.layerName)),
      [
        { layerName: "Empty", voxels: 0, chunks: 0 },
        { layerName: "Ground", voxels: 5, chunks: 2 },
        { layerName: "Top", voxels: 2, chunks: 1 }
      ]
    );
    assert.deepEqual(
      stats.blocks,
      new Map([[kGrass, 5], [kStone, 1], [kDeleted, 1]])
    );
  });

  it("lists unused registered blocks and orphan voxels", () => {
    const { stats } = makeEngine().inspector.blocks;

    assert.deepEqual(stats.unusedBlocks, [kUnused]);
    assert.deepEqual(stats.orphanBlocks, [kDeleted]);
    assert.equal(stats.orphanVoxels, 1);
  });

  it("reports where a block is used", () => {
    const engine = makeEngine();

    assert.deepEqual(engine.inspector.blocks.usageOf(kGrass), {
      blockId: kGrass,
      voxels: 5,
      layers: [{ layerName: "Ground", voxels: 5 }]
    });
    assert.deepEqual(engine.inspector.blocks.usageOf(kUnused), {
      blockId: kUnused,
      voxels: 0,
      layers: []
    });
  });

  it("reports the blocks and voxels referencing a tileset", () => {
    const { blocks } = makeEngine().inspector;

    assert.deepEqual(blocks.tilesetUsageOf("terrain"), {
      tilesetId: "terrain",
      blocks: [kGrass, kStone],
      voxels: 6
    });
    assert.deepEqual(blocks.tilesetUsageOf("props"), {
      tilesetId: "props",
      blocks: [kStone, kUnused],
      voxels: 1
    });
    assert.deepEqual(blocks.tilesetUsageOf("missing"), {
      tilesetId: "missing",
      blocks: [],
      voxels: 0
    });
  });

  it("follows edits and a loaded world without any rebuild", () => {
    const engine = makeEngine();
    engine.world.removeVoxel("Ground", { position: { x: 0, y: 0, z: 0 } });
    assert.equal(engine.inspector.blocks.usageOf(kGrass).voxels, 4);

    const saved = engine.save();
    const other = new VoxelEngine({
      chunkSize: 4,
      blocks: [makeBlockDef(kGrass, "cube")]
    });
    other.load(saved);

    assert.equal(other.inspector.blocks.stats.voxels, 6);
    assert.equal(other.inspector.blocks.usageOf(kGrass).voxels, 4);
  });
});
