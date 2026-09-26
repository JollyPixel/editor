// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { DownsampledWorld } from "../../src/mesh/index.ts";
import type { VoxelLayer } from "../../src/world/index.ts";
import {
  voxelBlockId,
  VOXEL_ABSENT
} from "../../src/world/packedVoxel.ts";
import { makeBlockDef } from "../helpers/blocks.ts";
import { makeEngine } from "../helpers/engine.ts";
import {
  CHUNK_SIZE as kChunkSize,
  CUBE_ID as kCubeId,
  RAMP_ID as kRampId
} from "../helpers/ids.ts";

// CONSTANTS
const kLayer = "Ground";

function makeWorld() {
  const engine = makeEngine({
    layers: [kLayer],
    blocks: [
      makeBlockDef(kCubeId, "cube"),
      makeBlockDef(kRampId, "cube")
    ]
  });
  const { world } = engine;
  const [layer] = world.getLayers();
  const mirror = new DownsampledWorld(world);

  function place(
    x: number,
    y: number,
    z: number,
    blockId = kCubeId
  ): void {
    world.setVoxel(kLayer, {
      position: { x, y, z },
      blockId
    });
  }

  function syncChunk(
    cx = 0,
    cy = 0,
    cz = 0
  ): VoxelLayer {
    const chunk = layer.getChunk(cx, cy, cz);
    assert.ok(chunk, `source chunk ${cx},${cy},${cz} must exist`);
    mirror.sync([{ layer, chunk }]);
    const [mirrored] = mirror.getLayers();

    return mirrored;
  }

  function mirroredBlock(
    mirrored: VoxelLayer,
    x: number,
    y: number,
    z: number,
    chunk = [0, 0, 0]
  ): number {
    const [cx, cy, cz] = chunk;
    const packed = mirrored.getChunk(cx, cy, cz)?.getPackedAt(x, y, z) ??
      VOXEL_ABSENT;

    return packed === VOXEL_ABSENT ? VOXEL_ABSENT : voxelBlockId(packed);
  }

  return {
    world,
    layer,
    mirror,
    place,
    syncChunk,
    mirroredBlock
  };
}

describe("DownsampledWorld", () => {
  it("halves the chunk grid", () => {
    const { mirror } = makeWorld();

    assert.equal(mirror.level, 1);
    assert.equal(mirror.scale, 2);
    assert.equal(mirror.chunkSize, kChunkSize / 2);
  });

  it("rejects a level the chunk size cannot hold", () => {
    const { world } = makeWorld();

    assert.throws(() => new DownsampledWorld(world, 3), RangeError);
    assert.throws(() => new DownsampledWorld(world, 0), RangeError);
  });

  it("mirrors the source layers with their identity and visibility", () => {
    const { world, layer, mirror } = makeWorld();
    layer.visible = false;

    const [mirrored] = mirror.getLayers();

    assert.equal(mirror.getLayers().length, world.getLayers().length);
    assert.equal(mirrored.id, layer.id);
    assert.equal(mirrored.visible, false);
    assert.notEqual(mirrored, layer);
  });

  it("places mirror layers on the coarse grid", () => {
    const { world, mirror } = makeWorld();
    world.setLayerPosition(kLayer, { x: 8, y: -4, z: 3 });

    const [mirrored] = mirror.getLayers();

    assert.deepEqual(mirrored.position, { x: 4, y: -2, z: 1 });
  });

  it("keeps the most frequent block of each cell", () => {
    const { place, syncChunk, mirroredBlock } = makeWorld();
    place(0, 0, 0, kRampId);
    place(1, 0, 0, kRampId);
    place(0, 1, 0, kRampId);
    place(1, 1, 0);
    place(0, 0, 1);
    place(1, 0, 1);
    place(0, 1, 1);

    const mirrored = syncChunk();

    assert.equal(mirroredBlock(mirrored, 0, 0, 0), kCubeId);
  });

  it("fills a cell from a single voxel and leaves empty cells empty", () => {
    const { place, syncChunk, mirroredBlock } = makeWorld();
    place(3, 3, 3);

    const mirrored = syncChunk();

    assert.equal(mirroredBlock(mirrored, 1, 1, 1), kCubeId);
    assert.equal(mirroredBlock(mirrored, 0, 0, 0), VOXEL_ABSENT);
  });

  it("resamples a chunk once its source changed", () => {
    const { world, place, syncChunk, mirroredBlock } = makeWorld();
    place(0, 0, 0);
    syncChunk();

    place(2, 2, 2);
    world.removeVoxel(kLayer, { position: { x: 0, y: 0, z: 0 } });
    const mirrored = syncChunk();

    assert.equal(mirroredBlock(mirrored, 0, 0, 0), VOXEL_ABSENT);
    assert.equal(mirroredBlock(mirrored, 1, 1, 1), kCubeId);
  });

  it("empties the mirror of a chunk that lost every voxel", () => {
    const { world, layer, place, mirror, syncChunk } = makeWorld();
    place(0, 0, 0);
    place(kChunkSize, 0, 0);
    syncChunk();

    world.removeVoxel(kLayer, { position: { x: kChunkSize, y: 0, z: 0 } });
    const chunk = layer.getChunk(0, 0, 0)!;
    mirror.sync([{ layer, chunk }]);

    const [mirrored] = mirror.getLayers();
    assert.equal(mirrored.getChunk(1, 0, 0)?.voxelCount ?? 0, 0);
  });

  it("brings the neighbouring chunks along, so boundary faces cull", () => {
    const { place, syncChunk, mirroredBlock } = makeWorld();
    place(0, 0, 0);
    place(kChunkSize, 0, 0);

    const mirrored = syncChunk();

    assert.equal(mirroredBlock(mirrored, 0, 0, 0, [1, 0, 0]), kCubeId);
  });

  it("returns only the mirror members holding voxels", () => {
    const { layer, mirror, place } = makeWorld();
    place(0, 0, 0);
    const chunk = layer.getChunk(0, 0, 0)!;

    const members = mirror.sync([{ layer, chunk }]);

    assert.equal(members.length, 1);
    assert.equal(members[0].chunk.size, kChunkSize / 2);
    assert.equal(members[0].layer.id, layer.id);
  });
});

describe("DownsampledWorld - coarse neighbours", () => {
  it("treats a neighbour outside the coarse set as empty", () => {
    const { layer, mirror, place } = makeWorld();
    place(0, 0, 0);
    place(kChunkSize, 0, 0);
    const chunk = layer.getChunk(0, 0, 0)!;

    mirror.sync([{ layer, chunk }], (candidate) => candidate === chunk);

    const [mirrored] = mirror.getLayers();
    assert.equal(mirrored.getChunk(0, 0, 0)?.voxelCount, 1);
    assert.equal(mirrored.getChunk(1, 0, 0)?.voxelCount ?? 0, 0);
  });

  it("resamples a neighbour once it joins the coarse set", () => {
    const { layer, mirror, place } = makeWorld();
    place(0, 0, 0);
    place(kChunkSize, 0, 0);
    const chunk = layer.getChunk(0, 0, 0)!;
    mirror.sync([{ layer, chunk }], (candidate) => candidate === chunk);

    mirror.sync([{ layer, chunk }]);

    const [mirrored] = mirror.getLayers();
    assert.equal(mirrored.getChunk(1, 0, 0)?.voxelCount, 1);
  });
});
