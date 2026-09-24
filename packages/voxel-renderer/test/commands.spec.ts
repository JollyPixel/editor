// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  isVoxelBlockCommand,
  isVoxelLayerCommand,
  isVoxelMaterialGroupCommand,
  isVoxelTilesetCommand,
  VOXEL_BLOCK_COMMAND_ACTIONS,
  VOXEL_COMMAND_ACTIONS,
  VOXEL_LAYER_COMMAND_ACTIONS,
  VOXEL_MATERIAL_GROUP_COMMAND_ACTIONS,
  VOXEL_TILESET_COMMAND_ACTIONS
} from "../src/commands.ts";

describe("command guards", () => {
  it("classifies each action into exactly one category", () => {
    for (const action of VOXEL_COMMAND_ACTIONS) {
      const command = { action };
      const matches = [
        isVoxelLayerCommand(command),
        isVoxelBlockCommand(command),
        isVoxelTilesetCommand(command),
        isVoxelMaterialGroupCommand(command)
      ].filter(Boolean);

      assert.equal(matches.length, 1, action);
    }
  });

  it("lists every category action once", () => {
    assert.equal(
      new Set(VOXEL_COMMAND_ACTIONS).size,
      VOXEL_LAYER_COMMAND_ACTIONS.length +
      VOXEL_BLOCK_COMMAND_ACTIONS.length +
      VOXEL_TILESET_COMMAND_ACTIONS.length +
      VOXEL_MATERIAL_GROUP_COMMAND_ACTIONS.length
    );
  });

  it("rejects an action outside the vocabulary", () => {
    const command = { action: "world-replace" };

    assert.equal(isVoxelLayerCommand(command), false);
    assert.equal(isVoxelBlockCommand(command), false);
    assert.equal(isVoxelTilesetCommand(command), false);
    assert.equal(isVoxelMaterialGroupCommand(command), false);
  });
});
