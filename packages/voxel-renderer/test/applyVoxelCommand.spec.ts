// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  applyVoxelCommand,
  type VoxelCommandTarget
} from "../src/applyVoxelCommand.ts";
import { BlockRegistry } from "../src/blocks/index.ts";
import { MaterialGroupList } from "../src/materials/index.ts";
import { TilesetList } from "../src/tileset/index.ts";
import { VoxelWorld } from "../src/world/index.ts";
import {
  blockDefinedCmd,
  makeAddedCommand
} from "./helpers/networkCommands.ts";

function makeTarget(): VoxelCommandTarget {
  return {
    world: new VoxelWorld(4),
    blocks: new BlockRegistry(),
    tilesets: new TilesetList(),
    materialGroups: new MaterialGroupList()
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

  it("routes a tileset command to the tileset list", () => {
    const target = makeTarget();
    const command = {
      action: "tileset-added",
      tileset: { id: "a", src: "a.png", tileSize: 16 }
    } as const;

    assert.notEqual(applyVoxelCommand(target, command), null);
    assert.equal(applyVoxelCommand(target, command), null);

    assert.equal(target.tilesets.get("a")?.tileSize, 16);
  });

  it("routes a material group command to the group list", () => {
    const target = makeTarget();
    const command = {
      action: "material-group-defined",
      group: { id: "gold", metalness: 1 }
    } as const;

    assert.notEqual(applyVoxelCommand(target, command), null);
    assert.equal(applyVoxelCommand(target, command), null);
    assert.equal(target.materialGroups.get("gold")?.metalness, 1);

    assert.notEqual(applyVoxelCommand(target, {
      action: "material-group-removed",
      groupId: "gold"
    }), null);
    assert.equal(target.materialGroups.has("gold"), false);
  });
});
