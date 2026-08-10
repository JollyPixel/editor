// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  formatNumber,
  parseNumeric,
  quantize
} from "../../src/numeric/format.ts";

describe("Numeric.formatNumber", () => {
  test("follows the step's precision, so a 0.01 field does not jitter mid scrub", () => {
    assert.equal(
      formatNumber(0.5, 0.01),
      "0.50"
    );
    assert.equal(
      formatNumber(1, 0.1),
      "1.0"
    );
    assert.equal(
      formatNumber(12, 1),
      "12"
    );
  });

  test("keeps a value finer than its step rather than rounding an edit away", () => {
    assert.equal(
      formatNumber(0.125, 1),
      "0.125"
    );
  });

  test("returns an empty string for a non finite value", () => {
    assert.equal(
      formatNumber(Number.NaN, 1),
      ""
    );
    assert.equal(
      formatNumber(Number.POSITIVE_INFINITY, 1),
      ""
    );
  });

  test("handles a scientific step without emitting exponent digits as decimals", () => {
    assert.equal(
      formatNumber(0.001, 1e-3),
      "0.001"
    );
  });

  test("preserves the sign of a negative value", () => {
    assert.equal(
      formatNumber(-2.5, 0.1),
      "-2.5"
    );
  });
});

describe("Numeric.parseNumeric", () => {
  test("returns null for blank input, which is a cancel and not a zero", () => {
    assert.equal(parseNumeric(""), null);
    assert.equal(parseNumeric("   "), null);
  });

  test("commits an expression", () => {
    assert.deepEqual(
      parseNumeric("1920/2"),
      { ok: true, value: 960 }
    );
    assert.deepEqual(
      parseNumeric(" (3+4)/2 "),
      { ok: true, value: 3.5 }
    );
  });

  test("commits a plain number through the fast path", () => {
    assert.deepEqual(
      parseNumeric("42"),
      { ok: true, value: 42 }
    );
  });

  test("reports a parse failure rather than throwing", () => {
    const result = parseNumeric("alert(1)");

    assert.equal(result?.ok, false);
  });

  test("reports a non finite result as a failure", () => {
    const result = parseNumeric("1/0");

    assert.equal(result?.ok, false);
  });
});

describe("Numeric.quantize", () => {
  test("snaps onto the step grid", () => {
    assert.equal(
      quantize(0.117, 0.05, -10, 10),
      0.1
    );
    assert.equal(
      quantize(7, 5, -100, 100),
      5
    );
  });

  test("clamps after snapping", () => {
    assert.equal(
      quantize(99, 1, 0, 10),
      10
    );
    assert.equal(
      quantize(-99, 1, 0, 10),
      0
    );
  });

  test("clears float drift left by the snap", () => {
    assert.equal(
      quantize(0.30000000000000004, 0.1, -10, 10),
      0.3
    );
  });

  test("leaves the value alone when the step is zero", () => {
    assert.equal(
      quantize(1.234, 0, -10, 10),
      1
    );
  });
});
