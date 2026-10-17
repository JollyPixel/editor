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
  it("reads a template in the chunk size it was saved with", () => {
    const world = new VoxelWorld(16);
    deserializeVoxelWorld(untrusted(emptyDocument({
      templates: [{
        id: "t1",
        name: "Pair",
        pivot: { x: 5, y: 0, z: 0 },
        chunkSize: 4,
        palette: [
          { block: 1, transform: 0 },
          { block: 2, transform: 5 }
        ],
        chunks: [
          { at: [0, 0, 0], cells: [0], runs: [1, 1] },
          { at: [1, 0, 0], cells: [1], runs: [1, 2] }
        ]
      }]
    })), world);

    const template = world.templates.get("t1");
    assert.ok(template !== undefined);
    assert.deepEqual(
      Array.from(template.localVoxels(), ([x, y, z, packed]) => [x, y, z, voxelBlockId(packed)]),
      [[0, 0, 0, 1], [5, 0, 0, 2]]
    );
    assert.deepEqual(template.pivot, { x: 5, y: 0, z: 0 });
    assert.equal(serializeVoxelWorld(world).templates?.[0].chunkSize, 16);
  });

  it("applies the serialized layer position to local voxel keys", () => {
    const world = new VoxelWorld(16);
    deserializeVoxelWorld(emptyDocument({
      layers: [{
        id: "ground",
        name: "Ground",
        visible: true,
        rank: "V",
        position: { x: 20, y: 3, z: -4 },
        palette: [{ block: 1, transform: 0 }],
        chunks: [{ at: [0, 0, 0], cells: [1298], runs: [1, 1] }]
      }]
    }), world);

    assert.ok(world.getVoxelAt({ x: 22, y: 4, z: 1 }) !== undefined);
    assert.equal(world.getVoxelAt({ x: 2, y: 1, z: 5 }), undefined);
  });
});
