// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { resolveRowDropZone } from "../../src/data/dropZone.ts";

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
