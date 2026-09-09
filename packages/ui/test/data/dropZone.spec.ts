// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  resolveDropDepth,
  resolveRowDropZone
} from "../../src/data/dropZone.ts";

describe("Data.resolveRowDropZone", () => {
  test("the top quarter is above", () => {
    assert.equal(resolveRowDropZone(0, 20), "above");
    assert.equal(resolveRowDropZone(4, 20), "above");
  });

  test("the bottom quarter is below", () => {
    assert.equal(resolveRowDropZone(16, 20), "below");
    assert.equal(resolveRowDropZone(19, 20), "below");
  });

  test("the middle half is inside, regardless of whether the row has children today", () => {
    assert.equal(resolveRowDropZone(5, 20), "inside");
    assert.equal(resolveRowDropZone(10, 20), "inside");
    assert.equal(resolveRowDropZone(15, 20), "inside");
  });

  test("scales the quarters with row height", () => {
    assert.equal(resolveRowDropZone(9, 40), "above");
    assert.equal(resolveRowDropZone(11, 40), "inside");
    assert.equal(resolveRowDropZone(31, 40), "below");
  });
});

describe("Data.resolveDropDepth", () => {
  test("picks the root band at the container's left edge", () => {
    assert.equal(resolveDropDepth(0, 0, 16, 3), 0);
  });

  test("steps one band deeper per indent unit", () => {
    assert.equal(resolveDropDepth(16, 0, 16, 3), 1);
    assert.equal(resolveDropDepth(32, 0, 16, 3), 2);
  });

  test("clamps to the root band left of the container", () => {
    assert.equal(resolveDropDepth(-40, 0, 16, 3), 0);
  });

  test("clamps to the deepest band past the chain's own depth", () => {
    assert.equal(resolveDropDepth(1000, 0, 16, 3), 2);
  });

  test("reads position relative to the container's left edge", () => {
    assert.equal(resolveDropDepth(116, 100, 16, 3), 1);
  });
});
