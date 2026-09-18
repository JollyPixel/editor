// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelWorld } from "../../src/world/index.ts";
import type { VoxelLayerCommand } from "../../src/commands.ts";
import { makeLogger } from "../helpers/fakes.ts";

// CONSTANTS
const kOrigin = { x: 0, y: 0, z: 0 };

const kVoxelCommands: VoxelLayerCommand[] = [
  {
    action: "voxel-set",
    layerName: "Gone",
    metadata: {
      position: kOrigin,
      blockId: 1,
      rotation: 0,
      flipX: false,
      flipZ: false,
      flipY: false
    }
  },
  {
    action: "voxels-set",
    layerName: "Gone",
    metadata: { entries: [{ position: kOrigin, blockId: 1 }] }
  },
  {
    action: "voxel-removed",
    layerName: "Gone",
    metadata: { position: kOrigin }
  },
  {
    action: "voxels-removed",
    layerName: "Gone",
    metadata: { entries: [{ position: kOrigin }] }
  }
];

describe("VoxelWorld.apply - unknown layer", () => {
  for (const command of kVoxelCommands) {
    it(`drops '${command.action}' and warns instead of throwing`, () => {
      const world = new VoxelWorld(4);
      const warnings: string[] = [];

      world.apply(command, makeLogger(warnings));

      assert.equal(world.getLayer("Gone"), undefined);
      assert.equal(warnings.length, 1);
      assert.match(warnings[0], new RegExp(`dropped '${command.action}' for unknown layer 'Gone'`));
    });
  }

  it("stays quiet when the layer is known", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Gone");
    const warnings: string[] = [];

    world.apply(kVoxelCommands[0], makeLogger(warnings));

    assert.deepEqual(warnings, []);
    assert.equal(world.getLayer("Gone")?.getVoxelAt(kOrigin)?.blockId, 1);
  });

  it("leaves the layer lifecycle actions to their own guards", () => {
    const world = new VoxelWorld(4);
    const warnings: string[] = [];

    world.apply({
      action: "merged",
      layerName: "Gone",
      metadata: { targetLayerName: "AlsoGone" }
    }, makeLogger(warnings));
    world.apply({
      action: "removed",
      layerName: "Gone",
      metadata: {}
    }, makeLogger(warnings));

    assert.deepEqual(warnings, []);
    assert.deepEqual(world.getLayers(), []);
  });
});
