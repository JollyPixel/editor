// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { unitRatio } from "../../src/numeric/bounds.ts";

describe("Numeric.unitRatio", () => {
  test("maps a value onto the unit interval", () => {
    assert.equal(unitRatio(25, 0, 100), 0.25);
    assert.equal(unitRatio(-5, 0, 100), 0);
    assert.equal(unitRatio(150, 0, 100), 1);
  });

  test("returns the degenerate ratio for an empty or inverted span", () => {
    assert.equal(unitRatio(3, 4, 4), 0);
    assert.equal(unitRatio(3, 4, 2, 0.5), 0.5);
  });
});
