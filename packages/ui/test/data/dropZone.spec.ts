// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  resolveDropDepth,
  resolveDropIndicatorRow,
  resolveRowDropStyle,
  resolveRowDropZone,
  TreeSnapshot
} from "../../src/data/tree/model.ts";
import {
  FOLDER_TREE,
  TREE
} from "../fixtures/tree.ts";

describe("Data.resolveRowDropZone", () => {
  test("accepts a row rectangle and client position", () => {
    assert.equal(
      resolveRowDropZone({ top: 100, height: 40 }, 105),
      "above"
    );
    assert.equal(
      resolveRowDropZone({ top: 100, height: 40 }, 120),
      "inside"
    );
    assert.equal(
      resolveRowDropZone({ top: 100, height: 40 }, 135),
      "below"
    );
  });

  test("the top quarter is above", () => {
    assert.equal(resolveRowDropZone(0, 20), "above");
    assert.equal(resolveRowDropZone(4, 20), "above");
  });

  test("the bottom quarter is below", () => {
    assert.equal(resolveRowDropZone(16, 20), "below");
    assert.equal(resolveRowDropZone(19, 20), "below");
  });

  test("the middle half is inside, regardless of whether the row has children today", () => {
    assert.equal(resolveRowDropZone(5, 20), "inside");
    assert.equal(resolveRowDropZone(10, 20), "inside");
    assert.equal(resolveRowDropZone(15, 20), "inside");
  });

  test("scales the quarters with row height", () => {
    assert.equal(resolveRowDropZone(9, 40), "above");
    assert.equal(resolveRowDropZone(11, 40), "inside");
    assert.equal(resolveRowDropZone(31, 40), "below");
  });
});

describe("Data.resolveDropDepth", () => {
  test("picks the root band at the container's left edge", () => {
    assert.equal(resolveDropDepth(0, 0, 16, 3), 0);
  });

  test("steps one band deeper per indent unit", () => {
    assert.equal(resolveDropDepth(16, 0, 16, 3), 1);
    assert.equal(resolveDropDepth(32, 0, 16, 3), 2);
  });

  test("clamps to the root band left of the container", () => {
    assert.equal(resolveDropDepth(-40, 0, 16, 3), 0);
  });

  test("clamps to the deepest band past the chain's own depth", () => {
    assert.equal(resolveDropDepth(1000, 0, 16, 3), 2);
  });

  test("reads position relative to the container's left edge", () => {
    assert.equal(resolveDropDepth(116, 100, 16, 3), 1);
  });
});

describe("Data.resolveDropIndicatorRow", () => {
  test("renders at the hovered row itself on a direct hover, even over a branch", () => {
    const snapshot = new TreeSnapshot(TREE, new Set(["a", "a2"]));

    assert.deepEqual(
      resolveDropIndicatorRow(snapshot, { targetId: "a", anchorId: "a", where: "below" }),
      { rowId: "a", where: "below", depth: 0 }
    );
  });

  test("renders at the hovered row itself for 'above' and 'inside' too", () => {
    const snapshot = new TreeSnapshot(TREE, new Set(["a", "a2"]));

    assert.deepEqual(
      resolveDropIndicatorRow(snapshot, { targetId: "a2", anchorId: "a2", where: "above" }),
      { rowId: "a2", where: "above", depth: 1 }
    );
    assert.deepEqual(
      resolveDropIndicatorRow(snapshot, { targetId: "a", anchorId: "a", where: "inside" }),
      { rowId: "a", where: "inside", depth: 0 }
    );
  });

  test("renders at the promoted boundary row, using the promoted target's depth", () => {
    const snapshot = new TreeSnapshot(TREE, new Set(["a", "a2"]));

    assert.deepEqual(
      resolveDropIndicatorRow(snapshot, { targetId: "a", anchorId: "a2a", where: "below" }),
      { rowId: "a2a", where: "below", depth: 0 }
    );
  });

  test("returns null when the target id is unknown", () => {
    const snapshot = new TreeSnapshot(TREE, new Set());

    assert.equal(
      resolveDropIndicatorRow(snapshot, { targetId: "missing", anchorId: "missing", where: "below" }),
      null
    );
  });

  test("stays on the parent's own row when hovering it directly, not its last child", () => {
    const snapshot = new TreeSnapshot(FOLDER_TREE, new Set(["r2"]));

    assert.deepEqual(
      resolveDropIndicatorRow(snapshot, { targetId: "r2", anchorId: "r2", where: "below" }),
      { rowId: "r2", where: "below", depth: 0 }
    );
  });
});

describe("Data.resolveRowDropStyle", () => {
  test("carries no drop line for a row the indicator does not anchor to", () => {
    assert.deepEqual(
      resolveRowDropStyle("a1", "calc(1 * 16px)", {
        rowId: "a2a",
        where: "below",
        depth: 0
      }),
      { drop: null, dropIndent: "calc(1 * 16px)" }
    );
  });

  test("carries no drop line when nothing is being dropped", () => {
    assert.deepEqual(
      resolveRowDropStyle("a1", "calc(1 * 16px)", null),
      { drop: null, dropIndent: "calc(1 * 16px)" }
    );
  });

  test("uses the indicator's target depth for the anchor row's drop line", () => {
    assert.deepEqual(
      resolveRowDropStyle("a2a", "calc(2 * 16px)", {
        rowId: "a2a",
        where: "below",
        depth: 0
      }),
      { drop: "below", dropIndent: "calc(0 * var(--jolly-tree-indent, 16px))" }
    );
  });
});
