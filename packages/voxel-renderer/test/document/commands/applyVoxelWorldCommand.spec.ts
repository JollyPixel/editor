// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { TilesetList } from "../../../src/document/tilesets/index.ts";
import { composeBlockId } from "../../../src/document/blocks/BlockId.ts";
import { VoxelWorld } from "../../../src/document/world/VoxelWorld.ts";
import {
  applyVoxelWorldCommand,
  type VoxelWorldCommandTarget
} from "../../../src/document/commands/applyVoxelCommand.ts";

function makeTarget(): VoxelWorldCommandTarget {
  return {
    world: new VoxelWorld(16),
    tilesets: new TilesetList([
      { id: "a", src: "a", tileSize: 16 },
      { id: "b", src: "b", tileSize: 16 }
    ])
  };
}

describe("applyTilesetCommand", () => {
  it("adds and removes tilesets", () => {
    const target = makeTarget();

    assert.notEqual(applyVoxelWorldCommand(target, {
      action: "tileset-added",
      tileset: { id: "c", src: "c", tileSize: 8 }
    }), null);
    assert.notEqual(applyVoxelWorldCommand(target, {
      action: "tileset-removed",
      tilesetId: "a"
    }), null);
    assert.deepEqual([...target.tilesets.ids()], ["b", "c"]);
  });

  it("returns the added tileset with the slot it received", () => {
    const target = makeTarget();

    assert.deepEqual(applyVoxelWorldCommand(target, {
      action: "tileset-added",
      tileset: { id: "c", asset: { id: "a1", kind: "tileset" } }
    }), {
      action: "tileset-added",
      tileset: {
        id: "c",
        slot: 2,
        asset: { id: "a1", kind: "tileset" }
      }
    });
  });

  it("never gives a new tileset the slot of voxels a removed one left", () => {
    const target = makeTarget();
    target.world.addLayer("Base");
    target.world.setVoxel("Base", {
      position: { x: 0, y: 0, z: 0 },
      blockId: composeBlockId(0, 1)
    });
    applyVoxelWorldCommand(target, {
      action: "tileset-removed",
      tilesetId: "a"
    });

    const added = applyVoxelWorldCommand(target, {
      action: "tileset-added",
      tileset: { id: "c", asset: { id: "a1", kind: "tileset" } }
    });

    assert.equal(added?.action === "tileset-added" && added.tileset.slot, 2);
  });

  it("returns null for a refused add or an unknown removal", () => {
    const target = makeTarget();

    assert.equal(applyVoxelWorldCommand(target, {
      action: "tileset-added",
      tileset: { id: "a", src: "dup", tileSize: 8 }
    }), null);
    assert.equal(applyVoxelWorldCommand(target, {
      action: "tileset-removed",
      tilesetId: "missing"
    }), null);
    assert.deepEqual([...target.tilesets.ids()], ["a", "b"]);
  });
});
