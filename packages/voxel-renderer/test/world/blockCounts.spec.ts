// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  VoxelChunk,
  VoxelWorld,
  packVoxel
} from "../../src/world/index.ts";

describe("VoxelChunk.countBlocks", () => {
  it("returns an empty histogram for a new chunk", () => {
    const chunk = new VoxelChunk([0, 0, 0], 4);

    assert.equal(chunk.countBlocks().size, 0);
  });

  it("counts voxels per block id and ignores the transform", () => {
    const chunk = new VoxelChunk([0, 0, 0], 4);
    chunk.setPackedAt(0, 0, 0, packVoxel(1, 0));
    chunk.setPackedAt(1, 0, 0, packVoxel(1, 3));
    chunk.setPackedAt(2, 0, 0, packVoxel(2, 0));

    assert.deepEqual([...chunk.countBlocks()], [[1, 2], [2, 1]]);
  });

  it("reuses the histogram until the chunk changes", () => {
    const chunk = new VoxelChunk([0, 0, 0], 4);
    chunk.setPackedAt(0, 0, 0, packVoxel(1, 0));

    const first = chunk.countBlocks();
    assert.equal(chunk.countBlocks(), first);

    chunk.setPackedAt(0, 0, 0, packVoxel(2, 0));
    const second = chunk.countBlocks();
    assert.notEqual(second, first);
    assert.deepEqual([...second], [[2, 1]]);
  });

  it("follows deletions but not deletions of absent voxels", () => {
    const chunk = new VoxelChunk([0, 0, 0], 4);
    chunk.setPackedAt(0, 0, 0, packVoxel(1, 0));
    chunk.setPackedAt(1, 0, 0, packVoxel(1, 0));
    const revision = chunk.revision;

    assert.equal(chunk.delete([3, 3, 3]), false);
    assert.equal(chunk.revision, revision);

    chunk.delete([0, 0, 0]);
    assert.deepEqual([...chunk.countBlocks()], [[1, 1]]);
  });

  it("follows copyFrom and clone", () => {
    const source = new VoxelChunk([0, 0, 0], 4);
    source.setPackedAt(0, 0, 0, packVoxel(5, 0));
    const target = new VoxelChunk([0, 0, 0], 4);
    target.countBlocks();

    target.copyFrom(source);

    assert.deepEqual([...target.countBlocks()], [[5, 1]]);
    assert.deepEqual([...source.clone().countBlocks()], [[5, 1]]);
  });
});

describe("VoxelLayer and VoxelWorld block counts", () => {
  function makeWorld(): VoxelWorld {
    const world = new VoxelWorld(4);
    world.addLayer("Ground");
    world.addLayer("Top");
    for (let x = 0; x < 6; x++) {
      world.setVoxel("Ground", {
        position: { x, y: 0, z: 0 },
        blockId: x < 4 ? 1 : 2
      });
    }
    world.setVoxel("Top", {
      position: { x: 0, y: 0, z: 0 },
      blockId: 2
    });

    return world;
  }

  it("counts voxels across chunks and layers", () => {
    const world = makeWorld();
    const ground = world.getLayer("Ground")!;

    assert.equal(ground.chunkCount, 2);
    assert.equal(ground.voxelCount, 6);
    assert.equal(world.voxelCount, 7);
    assert.equal(ground.countBlock(2), 2);
    assert.equal(world.countBlock(2), 3);
    assert.equal(world.countBlock(9), 0);
    assert.deepEqual(
      new Map(world.countBlocks()),
      new Map([[1, 4], [2, 3]])
    );
  });

  it("does not count an overwritten voxel twice", () => {
    const world = makeWorld();
    world.setVoxel("Ground", {
      position: { x: 0, y: 0, z: 0 },
      blockId: 2
    });

    assert.equal(world.voxelCount, 7);
    assert.equal(world.countBlock(1), 3);
    assert.equal(world.countBlock(2), 4);
  });

  it("follows removals, including the last voxel of a chunk", () => {
    const world = makeWorld();
    world.removeVoxel("Ground", { position: { x: 4, y: 0, z: 0 } });
    world.removeVoxel("Ground", { position: { x: 5, y: 0, z: 0 } });

    assert.equal(world.getLayer("Ground")!.chunkCount, 1);
    assert.equal(world.countBlock(2), 1);
    assert.equal(world.voxelCount, 5);
  });

  it("drops the counts of a removed layer", () => {
    const world = makeWorld();
    world.removeLayer("Top");

    assert.equal(world.voxelCount, 6);
    assert.equal(world.countBlock(2), 2);
  });

  it("keeps the counts through rebase, clone and merge", () => {
    const world = makeWorld();
    world.rebaseLayer("Ground", { x: 3, y: 1, z: 0 });
    assert.equal(world.getLayer("Ground")!.countBlock(1), 4);

    world.cloneLayer("Ground", { name: "Copy" });
    assert.equal(world.countBlock(1), 8);

    world.mergeLayer("Top", "Copy");
    assert.equal(world.getLayer("Copy")!.countBlock(2), 3);
    assert.equal(world.voxelCount, 12);
  });
});
