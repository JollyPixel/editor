// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  applyVoxelCommand,
  type VoxelCommandTarget
} from "../../../src/document/commands/index.ts";
import { BlockRegistry } from "../../../src/document/blocks/index.ts";
import {
  BlendGroupList,
  MaterialGroupList
} from "../../../src/document/materials/index.ts";
import { TilesetList } from "../../../src/document/tilesets/index.ts";
import { VoxelWorld } from "../../../src/document/world/index.ts";
import {
  blockDefinedCmd,
  makeAddedCommand
} from "../../helpers/networkCommands.ts";

function makeTarget(): VoxelCommandTarget {
  return {
    world: new VoxelWorld(4),
    blocks: new BlockRegistry(),
    tilesets: new TilesetList(),
    materialGroups: new MaterialGroupList(),
    blendGroups: new BlendGroupList()
  };
}

describe("applyVoxelCommand", () => {
  it("routes a layer command to the world without emitting", () => {
    const target = makeTarget();
    const emitted: string[] = [];
    target.world.on("command", (command) => emitted.push(command.action));

    assert.notEqual(applyVoxelCommand(target, makeAddedCommand("Ground")), null);

    assert.ok(target.world.getLayer("Ground"));
    assert.deepEqual(emitted, []);
  });

  it("routes a block command to the registry", () => {
    const target = makeTarget();

    assert.notEqual(applyVoxelCommand(target, blockDefinedCmd({ id: 4 })), null);

    assert.equal(target.blocks.has(4), true);
  });

  it("routes a material group command to the group list", () => {
    const target = makeTarget();
    const command = {
      action: "material-group-defined",
      group: { id: "gold", metalness: 1 }
    } as const;

    assert.notEqual(applyVoxelCommand(target, command), null);

    assert.equal(target.materialGroups.get("gold")?.metalness, 1);
  });

  it("routes a blend group command to the blend group list", () => {
    const target = makeTarget();
    const command = {
      action: "blend-group-defined",
      group: { id: "grass", width: 3 }
    } as const;

    assert.notEqual(applyVoxelCommand(target, command), null);

    assert.equal(target.blendGroups.get("grass")?.width, 3);
  });
});
