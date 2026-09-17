// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  isTileSize,
  MAX_TILE_SIZE,
  powerOfTwoTileSizes
} from "../../src/tileset/index.ts";

describe("isTileSize", () => {
  it("accepts integers from 1 to MAX_TILE_SIZE", () => {
    assert.equal(isTileSize(1), true);
    assert.equal(isTileSize(24), true);
    assert.equal(isTileSize(MAX_TILE_SIZE), true);
  });

  it("rejects anything else", () => {
    for (const value of [0, -16, 1.5, MAX_TILE_SIZE + 1, "16", Number.NaN, undefined]) {
      assert.equal(isTileSize(value), false);
    }
  });
});

describe("powerOfTwoTileSizes", () => {
  it("lists the powers of two within bounds", () => {
    assert.deepEqual(powerOfTwoTileSizes(8, 256), [8, 16, 32, 64, 128, 256]);
    assert.equal(powerOfTwoTileSizes().at(-1), MAX_TILE_SIZE);
  });
});
