// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { BlocksetSlot } from "../../../src/document/blocksets/index.ts";
import {
  composeBlockId,
  resolveBlockDefinition
} from "../../../src/document/blocks/index.ts";
import { makeBlockDef } from "../../helpers/blocks.ts";

// CONSTANTS
const kStone = new BlocksetSlot({
  id: "stone",
  slot: 3
});
const kLocalBlock = resolveBlockDefinition(makeBlockDef(5, "cube", {
  faceTextures: { top: { col: 1, row: 1 } },
  defaultTexture: { col: 2, row: 0 },
  materialGroup: "gold",
  blendGroup: "grass"
}));

describe("BlocksetSlot", () => {
  it("refuses a slot out of range", () => {
    assert.throws(
      () => new BlocksetSlot({ id: "stone", slot: 128 }),
      RangeError
    );
  });

  describe("project", () => {
    it("gives the block its world id, blockset and group names", () => {
      const projected = kStone.projectBlock(kLocalBlock);

      assert.equal(projected.id, composeBlockId(3, 5));
      assert.deepEqual(projected.defaultTexture, {
        blocksetId: "stone",
        col: 2,
        row: 0
      });
      assert.deepEqual(projected.faceTextures, {
        top: { blocksetId: "stone", col: 1, row: 1 }
      });
      assert.equal(projected.materialGroup, "stone/gold");
      assert.equal(projected.blendGroup, "stone/grass");
    });

    it("leaves a block without groups untouched on those fields", () => {
      const projected = kStone.projectBlock(
        resolveBlockDefinition(makeBlockDef(1, "cube"))
      );

      assert.equal("materialGroup" in projected, false);
      assert.equal("blendGroup" in projected, false);
    });

    it("projects every block of a blockset", () => {
      const blocks = kStone.projectBlocks([
        resolveBlockDefinition(makeBlockDef(1, "cube")),
        resolveBlockDefinition(makeBlockDef(2, "cube"))
      ]);

      assert.deepEqual(
        blocks.map(({ id }) => id),
        [composeBlockId(3, 1), composeBlockId(3, 2)]
      );
    });
  });

  describe("local", () => {
    it("inverts the projection", () => {
      assert.deepEqual(kStone.localizeBlock(kStone.projectBlock(kLocalBlock)), kLocalBlock);
    });

    it("keeps a group another blockset projected", () => {
      const block = {
        ...kLocalBlock,
        materialGroup: "other/gold"
      };

      assert.equal(kStone.localizeBlock(block).materialGroup, "other/gold");
    });
  });

  describe("group ids", () => {
    it("prefixes the group with the blockset id and strips it back", () => {
      const projected = kStone.qualifyGroupId("gold");

      assert.equal(projected, "stone/gold");
      assert.equal(kStone.decodeLocalGroupId(projected), "gold");
      assert.equal(kStone.decodeLocalGroupId("other/gold"), null);
    });

    it("projects and localizes a material group", () => {
      const projected = kStone.projectMaterialGroup({
        id: "gold",
        metalness: 1
      });

      assert.deepEqual(projected, { id: "stone/gold", metalness: 1 });
      assert.deepEqual(kStone.localizeMaterialGroup(projected), {
        id: "gold",
        metalness: 1
      });
    });

    it("prefixes a blend group and the groups it excludes", () => {
      assert.deepEqual(
        kStone.projectBlendGroup({ id: "grass", exclude: ["sand"] }),
        { id: "stone/grass", exclude: ["stone/sand"] }
      );
      assert.deepEqual(
        kStone.projectBlendGroup({ id: "sand" }),
        { id: "stone/sand" }
      );
    });
  });

  describe("owns", () => {
    it("recognizes ids projected into the blockset slot", () => {
      const origin = new BlocksetSlot({ id: "base", slot: 0 });

      assert.equal(kStone.ownsBlockId(composeBlockId(3, 9)), true);
      assert.equal(kStone.ownsBlockId(composeBlockId(2, 9)), false);
      assert.equal(origin.ownsBlockId(9), true);
      assert.equal(kStone.composeBlockId(9), composeBlockId(3, 9));
      assert.equal(kStone.decodeLocalBlockId(composeBlockId(3, 9)), 9);
    });
  });

  it("compares and serializes by id and slot", () => {
    assert.equal(kStone.equals(new BlocksetSlot({ id: "stone", slot: 3 })), true);
    assert.equal(kStone.equals(new BlocksetSlot({ id: "stone", slot: 2 })), false);
    assert.deepEqual(kStone.toJSON(), { id: "stone", slot: 3 });
  });
});
