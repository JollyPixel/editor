// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  decimalPlaces,
  measurePrecision,
  roundToPrecision
} from "../../src/numeric/precision.ts";

describe("Numeric.decimalPlaces", () => {
  test("counts decimals of a finite value", () => {
    assert.equal(decimalPlaces(3), 0);
    assert.equal(decimalPlaces(0.25), 2);
    assert.equal(decimalPlaces(-1.125), 3);
  });

  test("returns zero for an integer", () => {
    assert.equal(decimalPlaces(-0), 0);
    assert.equal(decimalPlaces(2 ** 53), 0);
    assert.equal(decimalPlaces(1e20), 0);
  });

  test("reads the exponent of e- notation", () => {
    assert.equal(decimalPlaces(1e-7), 7);
  });

  test("returns zero for a non finite value", () => {
    assert.equal(decimalPlaces(Number.NaN), 0);
    assert.equal(decimalPlaces(Number.POSITIVE_INFINITY), 0);
  });
});

describe("Numeric.measurePrecision", () => {
  test("keeps the finest precision among its values", () => {
    assert.equal(measurePrecision(0.1, 0.001, 5), 3);
  });

  test("caps a large precision at twelve decimals", () => {
    assert.equal(measurePrecision(1e-20), 12);
  });

  test("is zero without values", () => {
    assert.equal(measurePrecision(), 0);
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
