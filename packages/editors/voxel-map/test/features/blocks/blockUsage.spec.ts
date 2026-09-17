// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Third-party Dependencies
import {
  VoxelWorld,
  type ResolvedBlockDefinition,
  type VoxelLayerCommand
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  blockRemovalMessage,
  blockUsageSummary,
  formatCount,
  orphanVoxelsMessage,
  removeBlockVoxels,
  sortBlocksByUsage,
  tilesetRemovalMessage
} from "../../../src/features/blocks/blockUsage.ts";

function block(
  id: number
): ResolvedBlockDefinition {
  return {
    id,
    name: `Block ${id}`,
    shapeId: "cube",
    faceTextures: {},
    collidable: true,
    properties: {}
  };
}

describe("blockUsage", () => {
  it("formats counts with grouping and plurals", () => {
    assert.equal(formatCount(0, "voxel"), "0 voxels");
    assert.equal(formatCount(1, "voxel"), "1 voxel");
    assert.equal(formatCount(12345, "voxel"), "12,345 voxels");
  });

  it("sorts blocks by descending usage and keeps registry order on ties", () => {
    const blocks = [block(1), block(2), block(3), block(4)];
    const counts = new Map([[2, 5], [3, 9], [4, 5]]);

    assert.deepEqual(
      sortBlocksByUsage(blocks, counts).map(({ id }) => id),
      [3, 2, 4, 1]
    );
    assert.deepEqual(blocks.map(({ id }) => id), [1, 2, 3, 4]);
  });

  it("summarizes the usage of a block", () => {
    assert.equal(
      blockUsageSummary({ blockId: 1, voxels: 0, layers: [] }),
      "Not placed in the map"
    );
    assert.equal(
      blockUsageSummary({
        blockId: 1,
        voxels: 1200,
        layers: [
          { layerName: "Ground", voxels: 1000 },
          { layerName: "Top", voxels: 200 }
        ]
      }),
      "1,200 voxels in 2 layers"
    );
  });

  it("warns before removing a placed block", () => {
    assert.equal(
      blockRemovalMessage({ blockId: 1, voxels: 0, layers: [] }),
      "No voxel uses this block."
    );
    assert.equal(
      blockRemovalMessage({
        blockId: 1,
        voxels: 1,
        layers: [{ layerName: "Ground", voxels: 1 }]
      }),
      "Used by 1 voxel in 1 layer. " +
      "Those voxels stay in the map but are no longer drawn."
    );
  });

  it("warns before removing a tileset", () => {
    assert.equal(
      tilesetRemovalMessage({ tilesetId: "a", blocks: [], voxels: 0 }),
      "No block uses this tileset."
    );
    assert.equal(
      tilesetRemovalMessage({ tilesetId: "a", blocks: [1], voxels: 0 }),
      "1 block (none placed in the map) uses this tileset " +
      "and will lose its texture."
    );
    assert.equal(
      tilesetRemovalMessage({ tilesetId: "a", blocks: [1, 2], voxels: 2048 }),
      "2 blocks (2,048 voxels in the map) use this tileset " +
      "and will lose their texture."
    );
  });

  it("describes orphan voxels", () => {
    assert.equal(
      orphanVoxelsMessage(3, [7, 9]),
      "3 voxels of deleted blocks (#7, #9) cannot be drawn. " +
      "Remove them from every layer?"
    );
  });

  it("removes the voxels of the given blocks through commands", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Ground");
    world.addLayer("Shifted").position = { x: 10, y: 0, z: 0 };
    for (let x = 0; x < 6; x++) {
      world.setVoxel("Ground", {
        position: { x, y: 0, z: 0 },
        blockId: x % 2 === 0 ? 1 : 2
      });
    }
    world.setVoxel("Shifted", {
      position: { x: 15, y: 1, z: 2 },
      blockId: 1
    });
    const commands: VoxelLayerCommand[] = [];
    world.on("command", (command) => commands.push(command));

    const removed = removeBlockVoxels(world, new Set([1]));

    assert.equal(removed, 4);
    assert.equal(world.countBlock(1), 0);
    assert.equal(world.countBlock(2), 3);
    assert.deepEqual(
      commands.map(({ action, layerName }) => `${action}:${layerName}`),
      ["voxels-removed:Shifted", "voxels-removed:Ground"]
    );
    assert.equal(removeBlockVoxels(world, new Set([1])), 0);
    assert.equal(commands.length, 2);
  });
});
