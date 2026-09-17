// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  applyVoxelCommand,
  type VoxelCommandTarget
} from "../src/applyVoxelCommand.ts";
import { BlockRegistry } from "../src/blocks/index.ts";
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
    tilesets: new TilesetList()
  };
}

describe("applyVoxelCommand", () => {
  it("routes a layer command to the world without emitting", () => {
    const target = makeTarget();
    const emitted: string[] = [];
    target.world.on("command", (command) => emitted.push(command.action));

    assert.equal(applyVoxelCommand(target, makeAddedCommand("Ground")), true);

    assert.ok(target.world.getLayer("Ground"));
    assert.deepEqual(emitted, []);
  });

  it("routes a block command to the registry", () => {
    const target = makeTarget();

    assert.equal(applyVoxelCommand(target, blockDefinedCmd({ id: 4 })), true);

    assert.equal(target.blocks.has(4), true);
  });

  it("routes a tileset command to the tileset list", () => {
    const target = makeTarget();
    const command = {
      action: "tileset-added",
      tileset: { id: "a", src: "a.png", tileSize: 16 }
    } as const;

    assert.equal(applyVoxelCommand(target, command), true);
    assert.equal(applyVoxelCommand(target, command), false);

    assert.equal(target.tilesets.get("a")?.tileSize, 16);
  });
});
