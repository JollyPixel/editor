// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  clamp,
  unitRatio
} from "../../src/numeric/bounds.ts";

describe("Numeric.clamp", () => {
  test("keeps a value inside the bounds", () => {
    assert.equal(clamp(5, 0, 10), 5);
    assert.equal(clamp(-1, 0, 10), 0);
    assert.equal(clamp(11, 0, 10), 10);
  });
});

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
