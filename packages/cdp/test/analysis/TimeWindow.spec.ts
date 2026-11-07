// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { TimeWindow } from "../../src/analysis/TimeWindow.ts";

describe("TimeWindow", () => {
  test("rejects a window that ends before it starts", () => {
    assert.throws(() => TimeWindow.between(5, 1), RangeError);
  });
});
