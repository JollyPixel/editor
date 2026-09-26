// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  AIR_BLOCK_ID,
  composeBlockId,
  isAir,
  localBlockIdOf,
  MAX_LOCAL_BLOCK_ID,
  MAX_TILESET_SLOT,
  tilesetSlotOf
} from "../../src/blocks/index.ts";
import { MAX_BLOCK_ID } from "../../src/world/index.ts";

describe("AIR_BLOCK_ID", () => {
  it("is zero", () => {
    assert.equal(AIR_BLOCK_ID, 0);
  });
});

describe("isAir", () => {
  it("holds for the reserved id alone", () => {
    assert.equal(isAir(AIR_BLOCK_ID), true);
    assert.equal(isAir(1), false);
    assert.equal(isAir(-1), false);
  });
});

describe("composeBlockId", () => {
  it("keeps a slot 0 id unchanged", () => {
    assert.equal(composeBlockId(0, 7), 7);
  });

  it("splits back into the slot and local id", () => {
    for (const [slot, localId] of [
      [1, 1],
      [3, 500],
      [MAX_TILESET_SLOT, MAX_LOCAL_BLOCK_ID]
    ]) {
      const blockId = composeBlockId(slot, localId);

      assert.equal(tilesetSlotOf(blockId), slot);
      assert.equal(localBlockIdOf(blockId), localId);
    }
  });

  it("never exceeds the id a voxel can store", () => {
    assert.ok(composeBlockId(MAX_TILESET_SLOT, MAX_LOCAL_BLOCK_ID) <= MAX_BLOCK_ID);
  });

  it("rejects a slot or local id out of range", () => {
    for (const [slot, localId] of [
      [-1, 1],
      [MAX_TILESET_SLOT + 1, 1],
      [0.5, 1],
      [0, AIR_BLOCK_ID],
      [0, MAX_LOCAL_BLOCK_ID + 1],
      [0, 1.5]
    ]) {
      assert.throws(() => composeBlockId(slot, localId), RangeError);
    }
  });
});
