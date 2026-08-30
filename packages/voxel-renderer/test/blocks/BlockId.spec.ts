// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  AIR_BLOCK_ID,
  isAir
} from "../../src/blocks/BlockId.ts";

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
