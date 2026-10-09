// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  bitAt,
  hasFlag,
  setFlag,
  normalizeMask
} from "../../src/controls/flagMask.ts";

// CONSTANTS
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

describe("Controls.flags: 32 bit boundary", () => {
  test("keeps the high bit unsigned", () => {
    assert.equal(normalizeMask(kHighBit), kHighBit);
    assert.equal(setFlag(0, kHighBit, true), kHighBit);
    assert.equal(hasFlag(kHighBit, kHighBit), true);
  });

  test("combines the high bit with a low one without flipping sign", () => {
    const mask = setFlag(kHighBit, 1, true);

    assert.equal(mask, kHighBit + 1);
    assert.equal(hasFlag(mask, 1), true);
    assert.equal(hasFlag(mask, kHighBit), true);
  });

  test("clears the high bit back to zero", () => {
    assert.equal(setFlag(kHighBit, kHighBit, false), 0);
  });

  test("bitAt maps index 31 to the unsigned high bit and drops indices past it", () => {
    assert.equal(bitAt(0), 1);
    assert.equal(bitAt(31), kHighBit);
    assert.equal(bitAt(32), 0);
  });

  test("treats a non finite mask as empty", () => {
    assert.equal(normalizeMask(Number.NaN), 0);
    assert.equal(normalizeMask(Number.POSITIVE_INFINITY), 0);
  });
});
