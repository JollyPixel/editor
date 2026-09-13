// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import {
  beginKeyboardMove,
  cycleKeyboardDropWhere,
  moveKeyboardCursor
} from "../../src/data/tree/interaction.ts";
import { flattenVisible } from "../../src/data/tree/model.ts";
import type { TreeNode } from "../../src/data/tree/contract.ts";

// CONSTANTS
const kNodes: TreeNode[] = [
  { id: "a", label: "A" },
  { id: "b", label: "B" },
  { id: "c", label: "C" },
  { id: "d", label: "D" }
];
const kRows = flattenVisible(kNodes, new Set());

describe("tree keyboard move interaction", () => {
  test("moves the current selection and skips its rows", () => {
    const started = beginKeyboardMove(kRows, ["b", "c"], "b");

    assert.deepEqual(started, {
      kind: "keyboard-move",
      movedIds: ["b", "c"],
      cursorId: "a",
      where: "below"
    });
    assert.deepEqual(moveKeyboardCursor(started, kRows, 1), {
      ...started,
      cursorId: "d"
    });
  });

  test("keeps the cursor at an edge", () => {
    const started = beginKeyboardMove(kRows, ["b"], "b");

    assert.equal(moveKeyboardCursor(started, kRows, -1), started);
  });

  test("cycles all drop positions in both directions", () => {
    const started = beginKeyboardMove(kRows, ["b"], "b");
    const right = cycleKeyboardDropWhere(started, 1);

    assert.equal(
      right.kind === "keyboard-move" ? right.where : null,
      "above"
    );
    const left = cycleKeyboardDropWhere(right, -1);
    assert.equal(
      left.kind === "keyboard-move" ? left.where : null,
      "below"
    );
  });

  test("does not enter move mode when every row is selected", () => {
    assert.deepEqual(
      beginKeyboardMove(kRows, ["a", "b", "c", "d"], "a"),
      {
        kind: "idle",
        suppressClick: false
      }
    );
  });
});
