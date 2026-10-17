// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  deserializeVoxelWorld,
  serializeVoxelWorld,
  VOXEL_WORLD_VERSION,
  type VoxelWorldJSON
} from "../../../src/document/serialization/index.ts";
import { voxelBlockId, VoxelWorld } from "../../../src/document/world/index.ts";
import { BlocksetList, type BlocksetDefinition } from "../../../src/document/blocksets/index.ts";

// CONSTANTS
const kAtlas: BlocksetDefinition = {
  id: "atlas",
  src: "/atlas.png",
  tileSize: 16,
  cols: 4,
  rows: 4
};

function untrusted(
  document: object
): VoxelWorldJSON {
  return JSON.parse(JSON.stringify(document));
}

function emptyDocument(
  fields: Partial<VoxelWorldJSON> = {}
): VoxelWorldJSON {
  return {
    version: VOXEL_WORLD_VERSION,
    chunkSize: 16,
    blocksets: [],
    layers: [],
    ...fields
  };
}

describe("deserializeVoxelWorld", () => {
  it("clears the world before restoring", () => {
    const world = new VoxelWorld(16);
    world.addLayer("Existing");
    deserializeVoxelWorld(emptyDocument(), world);

    assert.equal(world.getLayers().length, 0);
  });

  it("replaces the blockset links, clearing them when none are saved", () => {
    const blocksets = new BlocksetList([kAtlas]);

    deserializeVoxelWorld(
      emptyDocument({
        blocksets: [{ id: "ground", asset: { id: "a1", kind: "blockset" } }]
      }),
      new VoxelWorld(16),
      { blocksets }
    );
    assert.deepEqual([...blocksets.ids()], ["ground"]);

    deserializeVoxelWorld(emptyDocument(), new VoxelWorld(16), { blocksets });
    assert.equal(blocksets.size, 0);
  });

  it("defaults compositing and drops a retired opacity in an older save file", () => {
    const world = new VoxelWorld(16);
    deserializeVoxelWorld(
      untrusted({
        ...emptyDocument(),
        layers: [{
          id: "l1",
          name: "Ground",
          visible: true,
          opacity: 0.5,
          rank: "V",
          palette: [],
          chunks: []
        }]
      }),
      world
    );

    const layer = world.getLayer("Ground");
    assert.ok(layer !== undefined);
    assert.equal(layer.compositing, "composite");
    assert.equal("opacity" in serializeVoxelWorld(world).layers[0], false);
  });

  it("stacks layers by their saved rank and renumbers them densely", () => {
    const world = new VoxelWorld(16);

    deserializeVoxelWorld(
      untrusted(emptyDocument({
        layers: [
          { id: "ground", name: "Ground", visible: true, rank: "2", palette: [], chunks: [] },
          { id: "top", name: "Top", visible: true, rank: "7", palette: [], chunks: [] }
        ]
      })),
      world
    );

    assert.deepEqual(
      world.getLayers().map(({ name, order }) => [name, order]),
      [["Top", 1], ["Ground", 0]]
    );
  });

  it("ignores unknown layer and chunk fields", () => {
    const world = new VoxelWorld(16);

    deserializeVoxelWorld(
      untrusted({
        ...emptyDocument(),
        layers: [{
          id: "l1",
          name: "Ground",
          visible: true,
          rank: "V",
          tint: "red",
          palette: [{ block: 2, transform: 0 }],
          chunks: [{ at: [0, 0, 0], cells: [0], runs: [1, 1], lod: 2 }]
        }]
      }),
      world
    );

    assert.equal(world.getVoxelAt({ x: 0, y: 0, z: 0 })?.blockId, 2);
  });

  it("re-partitions a document saved with another chunk size", () => {
    const world = new VoxelWorld(16);

    deserializeVoxelWorld(
      untrusted(emptyDocument({
        chunkSize: 8,
        layers: [{
          id: "l1",
          name: "Ground",
          visible: true,
          rank: "V",
          palette: [1, 2, 3, 4, 5].map((block) => {
            return { block, transform: 0 };
          }),
          chunks: [
            { at: [0, 0, 0], cells: [0, 6], runs: [1, 1, 1, 2] },
            { at: [1, 0, 0], cells: [0], runs: [1, 3] },
            { at: [1, 1, -1], cells: [463], runs: [1, 4] },
            { at: [2, 0, 0], cells: [0], runs: [1, 5] }
          ]
        }]
      })),
      world
    );

    const layer = world.getLayer("Ground");
    assert.ok(layer !== undefined);
    assert.equal(layer.voxelCount, 5);
    assert.equal(layer.chunkCount, 3);
    assert.deepEqual(
      Array.from(layer.localVoxels(), ([x, y, z, packed]) => [x, y, z, voxelBlockId(packed)])
        .sort((p, q) => p[3] - q[3]),
      [
        [0, 0, 0, 1],
        [7, 0, 0, 2],
        [8, 0, 0, 3],
        [15, 9, -1, 4],
        [16, 0, 0, 5]
      ]
    );
    assert.equal(serializeVoxelWorld(world).chunkSize, 16);
  });

  it("re-partitions merged cells saved with another chunk size", () => {
    const world = new VoxelWorld(16);

    deserializeVoxelWorld(
      untrusted(emptyDocument({
        chunkSize: 8,
        layers: [{
          id: "l1",
          name: "Ground",
          visible: true,
          rank: "V",
          palette: [1, 2].map((block) => {
            return { block, transform: 0 };
          }),
          chunks: [
            {
              at: [1, 0, 0],
              cells: [3],
              runs: [1, 1],
              partners: { cells: [3], runs: [1, 2] }
            }
          ]
        }]
      })),
      world
    );

    assert.equal(world.getVoxelAt({ x: 11, y: 0, z: 0 })?.partner?.blockId, 2);
  });

  it("rejects a partner on a cell that holds no voxel", () => {
    assert.throws(
      () => deserializeVoxelWorld(untrusted(emptyDocument({
        layers: [{
          id: "l1",
          name: "Ground",
          visible: true,
          rank: "V",
          palette: [{ block: 1, transform: 0 }],
          chunks: [
            {
              at: [0, 0, 0],
              cells: [0],
              runs: [1, 1],
              partners: { cells: [1], runs: [1, 1] }
            }
          ]
        }]
      })), new VoxelWorld(16)),
      /chunk \[0,0,0\]: cell 1 has a partner but no voxel/
    );
  });

  it("leaves the world and blocksets untouched when the document is invalid", () => {
    const world = new VoxelWorld(16);
    world.addLayer("Existing");
    const blocksets = new BlocksetList([kAtlas]);
    assert.throws(
      () => deserializeVoxelWorld(untrusted({ version: 3 }), world, { blocksets })
    );
    assert.equal(world.getLayers().length, 1);
    assert.equal(blocksets.has("atlas"), true);
  });

  it("leaves the world untouched when a chunk does not fit its chunk size", () => {
    const world = new VoxelWorld(16);
    world.addLayer("Existing");
    const blocksets = new BlocksetList([kAtlas]);

    assert.throws(
      () => deserializeVoxelWorld(untrusted(emptyDocument({
        chunkSize: 32,
        layers: [{
          id: "l1",
          name: "Ground",
          visible: true,
          rank: "V",
          palette: [{ block: 1, transform: 0 }],
          chunks: [{ at: [1000, 0, 0], cells: [0], runs: [1, 1] }]
        }]
      })), world, { blocksets }),
      /layer "l1", chunk \[1000,0,0\] does not fit a world with chunkSize 16/
    );
    assert.deepEqual(world.getLayers().map(({ name }) => name), ["Existing"]);
    assert.equal(blocksets.has("atlas"), true);
  });
});
