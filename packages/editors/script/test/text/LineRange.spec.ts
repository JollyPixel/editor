// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { LineRange } from "#src/text/LineRange.ts";

describe("LineRange", () => {
  test("intersect keeps only the shared lines, and disjoint ranges cover none", () => {
    const visible = new LineRange(10, 20);

    assert.deepEqual([...visible.intersect(new LineRange(4, 12))], [10, 11, 12]);
    assert.deepEqual([...visible.intersect(new LineRange(30, 40))], []);
  });
});
