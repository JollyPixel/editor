// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  hasFlag,
  setFlag,
  toggleFlag,
  selectedFlags,
  maskFromFlags,
  normalizeMask
} from "../../src/controls/flagMask.ts";

// CONSTANTS
const kLayers = [1, 2, 4, 8];
const kHighBit = 2 ** 31;

describe("Controls.hasFlag", () => {
  test("reads a set bit", () => {
    assert.equal(hasFlag(0b0101, 0b0001), true);
    assert.equal(hasFlag(0b0101, 0b0100), true);
  });

  test("reads a clear bit", () => {
    assert.equal(hasFlag(0b0101, 0b0010), false);
  });

  test("is false against an empty mask", () => {
    assert.equal(hasFlag(0, 4), false);
  });
});

describe("Controls.setFlag", () => {
  test("sets and clears without disturbing its neighbours", () => {
    assert.equal(
      setFlag(0b0101, 0b0010, true),
      0b0111
    );
    assert.equal(
      setFlag(0b0101, 0b0100, false),
      0b0001
    );
  });

  test("is idempotent", () => {
    assert.equal(
      setFlag(0b0100, 0b0100, true),
      0b0100
    );
    assert.equal(
      setFlag(0b0001, 0b0100, false),
      0b0001
    );
  });
});

describe("Controls.toggleFlag", () => {
  test("round trips", () => {
    const once = toggleFlag(0b0001, 0b0100);

    assert.equal(once, 0b0101);
    assert.equal(toggleFlag(once, 0b0100), 0b0001);
  });
});

describe("Controls.selectedFlags", () => {
  test("returns set bits in declared order", () => {
    assert.deepEqual(
      selectedFlags(0b1001, kLayers),
      [1, 8]
    );
  });

  test("returns nothing for an empty mask", () => {
    assert.deepEqual(
      selectedFlags(0, kLayers),
      []
    );
  });

  test("ignores bits the field does not declare", () => {
    assert.deepEqual(
      selectedFlags(0b1_0000, kLayers),
      []
    );
  });
});

describe("Controls.maskFromFlags", () => {
  test("combines bits", () => {
    assert.equal(
      maskFromFlags([1, 8]),
      0b1001
    );
  });

  test("is empty for no bits", () => {
    assert.equal(
      maskFromFlags([]),
      0
    );
  });

  test("round trips with selectedFlags", () => {
    const mask = maskFromFlags([2, 4]);

    assert.deepEqual(
      selectedFlags(mask, kLayers),
      [2, 4]
    );
  });
});

/**
 * Bitwise operators are signed 32 bit, so bit 31 is where a naive implementation returns a negative
 * mask and comparisons against a stored value stop matching.
 */
describe("Controls.flags: 32 bit boundary", () => {
  test("keeps the high bit unsigned", () => {
    assert.equal(normalizeMask(kHighBit), kHighBit);
    assert.equal(setFlag(0, kHighBit, true), kHighBit);
    assert.equal(hasFlag(kHighBit, kHighBit), true);
  });

  test("combines the high bit with a low one without flipping sign", () => {
    const mask = setFlag(kHighBit, 1, true);

    assert.equal(mask > 0, true);
    assert.deepEqual(
      selectedFlags(mask, [1, kHighBit]),
      [1, kHighBit]
    );
  });

  test("clears the high bit back to zero", () => {
    assert.equal(setFlag(kHighBit, kHighBit, false), 0);
  });

  test("treats a non finite mask as empty", () => {
    assert.equal(normalizeMask(Number.NaN), 0);
    assert.equal(normalizeMask(Number.POSITIVE_INFINITY), 0);
  });
});
