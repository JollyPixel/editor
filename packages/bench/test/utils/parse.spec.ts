// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  it
} from "node:test";

// Import Internal Dependencies
import { positiveNumber } from "../../src/utils/parse.ts";

describe("positiveNumber", () => {
  it("should parse a strictly positive number", () => {
    assert.equal(positiveNumber("12"), 12);
    assert.equal(positiveNumber("0.5"), 0.5);
  });

  it("should reject anything that is not one", () => {
    for (const raw of ["0", "-1", "nope", "12abc", "", "Infinity"]) {
      assert.equal(positiveNumber(raw), null, raw);
    }
  });
});
