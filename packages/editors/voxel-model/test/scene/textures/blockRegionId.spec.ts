// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  blockRegionId,
  blockUuidFromRegion
} from "#src/scene/textures/blockRegionId.ts";

describe("blockRegionId", () => {
  test("round-trips a block uuid", () => {
    assert.equal(blockRegionId("torso"), "block-torso");
    assert.equal(blockUuidFromRegion(blockRegionId("torso")), "torso");
  });

  test("keeps a uuid that itself contains the prefix", () => {
    assert.equal(blockUuidFromRegion("block-block-1"), "block-1");
  });

  test("rejects a region that belongs to no block", () => {
    assert.equal(blockUuidFromRegion("unrelated-region"), null);
    assert.equal(blockUuidFromRegion("my-block-1"), null);
  });
});
