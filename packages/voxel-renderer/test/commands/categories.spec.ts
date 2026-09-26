// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  isTilesetDocumentCommand,
  isVoxelBlockCommand,
  isVoxelLayerCommand,
  isVoxelMaterialGroupCommand,
  isVoxelTilesetCommand,
  isVoxelWorldCommand,
  TILESET_DOCUMENT_COMMAND_ACTIONS,
  VOXEL_BLOCK_COMMAND_ACTIONS,
  VOXEL_COMMAND_ACTIONS,
  VOXEL_LAYER_COMMAND_ACTIONS,
  VOXEL_MATERIAL_GROUP_COMMAND_ACTIONS,
  VOXEL_TILESET_COMMAND_ACTIONS,
  VOXEL_WORLD_COMMAND_ACTIONS
} from "../../src/commands/index.ts";

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

  it("splits the vocabulary between world and tileset document commands", () => {
    for (const action of VOXEL_COMMAND_ACTIONS) {
      const command = { action };

      assert.notEqual(
        isVoxelWorldCommand(command),
        isTilesetDocumentCommand(command),
        action
      );
    }
    assert.equal(isTilesetDocumentCommand({ action: "tile-size-updated" }), true);
    assert.equal(isVoxelWorldCommand({ action: "tile-size-updated" }), false);
    assert.deepEqual(
      [...VOXEL_WORLD_COMMAND_ACTIONS, ...TILESET_DOCUMENT_COMMAND_ACTIONS].sort(),
      [...VOXEL_COMMAND_ACTIONS, "tile-size-updated"].sort()
    );
  });

  it("rejects an action outside the vocabulary", () => {
    const command = { action: "world-replace" };

    assert.equal(isVoxelLayerCommand(command), false);
    assert.equal(isVoxelBlockCommand(command), false);
    assert.equal(isVoxelTilesetCommand(command), false);
    assert.equal(isVoxelMaterialGroupCommand(command), false);
    assert.equal(isVoxelWorldCommand(command), false);
    assert.equal(isTilesetDocumentCommand(command), false);
  });
});
