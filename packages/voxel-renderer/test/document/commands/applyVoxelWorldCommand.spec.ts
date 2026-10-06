// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { BlocksetList } from "../../../src/document/blocksets/index.ts";
import { composeBlockId } from "../../../src/document/blocks/BlockId.ts";
import { VoxelWorld } from "../../../src/document/world/VoxelWorld.ts";
import {
  applyVoxelWorldCommand,
  type VoxelWorldCommandTarget
} from "../../../src/document/commands/applyVoxelCommand.ts";

function makeTarget(): VoxelWorldCommandTarget {
  return {
    world: new VoxelWorld(16),
    blocksets: new BlocksetList([
      { id: "a", src: "a", tileSize: 16 },
      { id: "b", src: "b", tileSize: 16 }
    ])
  };
}

describe("applyVoxelWorldCommand - blocksets", () => {
  it("adds and removes blocksets", () => {
    const target = makeTarget();

    assert.notEqual(applyVoxelWorldCommand(target, {
      action: "blockset-added",
      blockset: { id: "c", src: "c", tileSize: 8 }
    }), null);
    assert.notEqual(applyVoxelWorldCommand(target, {
      action: "blockset-removed",
      blocksetId: "a"
    }), null);
    assert.deepEqual([...target.blocksets.ids()], ["b", "c"]);
  });

  it("returns the added blockset with the slot it received", () => {
    const target = makeTarget();

    assert.deepEqual(applyVoxelWorldCommand(target, {
      action: "blockset-added",
      blockset: { id: "c", asset: { id: "a1", kind: "blockset" } }
    }), {
      action: "blockset-added",
      blockset: {
        id: "c",
        slot: 2,
        asset: { id: "a1", kind: "blockset" }
      }
    });
  });

  for (const holder of ["voxels", "a template"] as const) {
    it(`never gives a new blockset the slot of ${holder} a removed one left`, () => {
      const target = makeTarget();
      const position = { x: 0, y: 0, z: 0 };
      target.world.addLayer("Base");
      target.world.setVoxel("Base", {
        position,
        blockId: composeBlockId(0, 1)
      });
      if (holder === "a template") {
        target.world.templates.createFromLayer("Base", { name: "Kept" });
        target.world.removeVoxel("Base", { position });
      }
      applyVoxelWorldCommand(target, {
        action: "blockset-removed",
        blocksetId: "a"
      });

      const added = applyVoxelWorldCommand(target, {
        action: "blockset-added",
        blockset: { id: "c", asset: { id: "a1", kind: "blockset" } }
      });

      assert.equal(added?.action === "blockset-added" && added.blockset.slot, 2);
    });
  }

  it("returns null for a refused add or an unknown removal", () => {
    const target = makeTarget();

    assert.equal(applyVoxelWorldCommand(target, {
      action: "blockset-added",
      blockset: { id: "a", src: "dup", tileSize: 8 }
    }), null);
    assert.equal(applyVoxelWorldCommand(target, {
      action: "blockset-removed",
      blocksetId: "missing"
    }), null);
    assert.deepEqual([...target.blocksets.ids()], ["a", "b"]);
  });
});
