// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  decimalPlaces,
  precisionOf,
  roundToPrecision
} from "../../src/numeric/precision.ts";

describe("Numeric.decimalPlaces", () => {
  test("counts decimals of a finite value", () => {
    assert.equal(decimalPlaces(3), 0);
    assert.equal(decimalPlaces(0.25), 2);
    assert.equal(decimalPlaces(-1.125), 3);
  });

  test("reads the exponent of e- notation", () => {
    assert.equal(decimalPlaces(1e-7), 7);
  });

  test("returns zero for a non finite value", () => {
    assert.equal(decimalPlaces(Number.NaN), 0);
    assert.equal(decimalPlaces(Number.POSITIVE_INFINITY), 0);
  });
});

describe("Numeric.precisionOf", () => {
  test("keeps the finest precision among its values", () => {
    assert.equal(precisionOf(0.1, 0.001, 5), 3);
  });

  test("caps a large precision at twelve decimals", () => {
    assert.equal(precisionOf(1e-20), 12);
  });

  test("is zero without values", () => {
    assert.equal(precisionOf(), 0);
  });
});

describe("Numeric.roundToPrecision", () => {
  test("clears float drift at the given precision", () => {
    assert.equal(roundToPrecision(0.1 + 0.2, 1), 0.3);
  });

  test("caps the decimals at twelve", () => {
    assert.equal(
      roundToPrecision(0.1234567890123456, 20),
      0.123456789012
    );
  });
});
