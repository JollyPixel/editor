// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  tabDropTarget,
  tabSegment
} from "../../../src/containers/tabs/tabReorder.ts";

describe("tabSegment", () => {
  test("spans every tab when none is fixed", () => {
    assert.deepEqual(tabSegment([false, false, false], 1), {
      start: 0,
      end: 3
    });
  });

  test("starts after a leading fixed tab", () => {
    assert.deepEqual(tabSegment([true, false, false], 2), {
      start: 1,
      end: 3
    });
  });

  test("stops at the nearest fixed tab on each side", () => {
    assert.deepEqual(tabSegment([false, true, false, false, true, false], 3), {
      start: 2,
      end: 4
    });
  });

  test("returns null for a fixed tab", () => {
    assert.equal(tabSegment([true, false], 0), null);
  });

  test("returns null out of range", () => {
    assert.equal(tabSegment([false], 1), null);
    assert.equal(tabSegment([false], -1), null);
  });
});

describe("tabDropTarget", () => {
  const segment = {
    start: 1,
    end: 4
  };

  test("moves a tab forward past its successors", () => {
    assert.equal(tabDropTarget(segment, 1, 3), 3);
  });

  test("moves a tab backward to the segment start", () => {
    assert.equal(tabDropTarget(segment, 3, 0), 1);
  });

  test("returns null on either side of the tab itself", () => {
    assert.equal(tabDropTarget(segment, 2, 1), null);
    assert.equal(tabDropTarget(segment, 2, 2), null);
  });

  test("clamps an insertion outside the segment", () => {
    assert.equal(tabDropTarget(segment, 2, -5), 1);
    assert.equal(tabDropTarget(segment, 2, 10), 3);
  });
});
