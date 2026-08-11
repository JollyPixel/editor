// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { nextEnabledIndex } from "../../src/controls/roving.ts";

describe("Controls.nextEnabledIndex", () => {
  test("steps forward and back", () => {
    const all = [true, true, true];

    assert.equal(
      nextEnabledIndex(all, 0, 1),
      1
    );
    assert.equal(
      nextEnabledIndex(all, 2, -1),
      1
    );
  });

  test("wraps at both ends", () => {
    const all = [true, true, true];

    assert.equal(
      nextEnabledIndex(all, 2, 1),
      0
    );
    assert.equal(
      nextEnabledIndex(all, 0, -1),
      2
    );
  });

  test("skips disabled entries", () => {
    const some = [true, false, false, true];

    assert.equal(
      nextEnabledIndex(some, 0, 1),
      3
    );
    assert.equal(
      nextEnabledIndex(some, 3, 1),
      0
    );
    assert.equal(
      nextEnabledIndex(some, 0, -1),
      3
    );
  });

  test("returns the only enabled entry, including from itself", () => {
    const one = [false, true, false];

    assert.equal(
      nextEnabledIndex(one, 1, 1),
      1
    );
    assert.equal(
      nextEnabledIndex(one, 0, 1),
      1
    );
  });

  /** Otherwise an all disabled group loops forever looking for a stop that does not exist. */
  test("returns -1 when nothing is selectable", () => {
    assert.equal(
      nextEnabledIndex([false, false], 0, 1),
      -1
    );
    assert.equal(
      nextEnabledIndex([], 0, 1),
      -1
    );
  });

  test("returns -1 for a zero step", () => {
    assert.equal(
      nextEnabledIndex([true, true], 0, 0),
      -1
    );
  });
});
