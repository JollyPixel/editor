// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { resolveSelection } from "../../src/data/selection.ts";
import { flattenVisible } from "../../src/data/treeNodes.ts";
import type { TreeNode } from "../../src/data/Tree.types.ts";

// CONSTANTS
const kTree: TreeNode[] = [
  {
    id: "a",
    label: "A",
    children: [
      { id: "a1", label: "A1" },
      { id: "a2", label: "A2" },
      { id: "a3", label: "A3" },
      { id: "a4", label: "A4" }
    ]
  },
  { id: "b", label: "B" }
];
const kRows = flattenVisible(kTree, new Set(["a"]));

describe("Data.resolveSelection", () => {
  test("a plain click replaces the selection", () => {
    const result = resolveSelection({
      rows: kRows,
      clickedId: "a2",
      current: ["a1"],
      anchorId: "a1",
      shiftKey: false,
      ctrlKey: false,
      multiple: true
    });

    assert.deepEqual(result, { selected: ["a2"], anchorId: "a2" });
  });

  test("every click replaces the selection when multiple is off, modifiers or not", () => {
    const result = resolveSelection({
      rows: kRows,
      clickedId: "a2",
      current: ["a1"],
      anchorId: "a1",
      shiftKey: true,
      ctrlKey: false,
      multiple: false
    });

    assert.deepEqual(result, { selected: ["a2"], anchorId: "a2" });
  });

  test("ctrl adds to the selection", () => {
    const result = resolveSelection({
      rows: kRows,
      clickedId: "a2",
      current: ["a1"],
      anchorId: "a1",
      shiftKey: false,
      ctrlKey: true,
      multiple: true
    });

    assert.deepEqual(result, { selected: ["a1", "a2"], anchorId: "a1" });
  });

  test("ctrl removes an already-selected row", () => {
    const result = resolveSelection({
      rows: kRows,
      clickedId: "a1",
      current: ["a1", "a2"],
      anchorId: "a1",
      shiftKey: false,
      ctrlKey: true,
      multiple: true
    });

    assert.deepEqual(result, { selected: ["a2"], anchorId: "a2" });
  });

  test("shift selects the contiguous sibling range from the anchor", () => {
    const result = resolveSelection({
      rows: kRows,
      clickedId: "a3",
      current: ["a1"],
      anchorId: "a1",
      shiftKey: true,
      ctrlKey: false,
      multiple: true
    });

    assert.deepEqual(result, { selected: ["a1", "a2", "a3"], anchorId: "a1" });
  });

  test("shift range works in either direction from the anchor", () => {
    const result = resolveSelection({
      rows: kRows,
      clickedId: "a1",
      current: ["a3"],
      anchorId: "a3",
      shiftKey: true,
      ctrlKey: false,
      multiple: true
    });

    assert.deepEqual(result, { selected: ["a1", "a2", "a3"], anchorId: "a3" });
  });

  test("a second shift click re-anchors from the same row, not the previous range", () => {
    const first = resolveSelection({
      rows: kRows,
      clickedId: "a3",
      current: ["a1"],
      anchorId: "a1",
      shiftKey: true,
      ctrlKey: false,
      multiple: true
    });
    const second = resolveSelection({
      rows: kRows,
      clickedId: "a2",
      current: first.selected,
      anchorId: first.anchorId,
      shiftKey: true,
      ctrlKey: false,
      multiple: true
    });

    assert.deepEqual(second, { selected: ["a1", "a2"], anchorId: "a1" });
  });

  test("shift and ctrl are a no-op across two different sibling groups", () => {
    const shiftResult = resolveSelection({
      rows: kRows,
      clickedId: "b",
      current: ["a1"],
      anchorId: "a1",
      shiftKey: true,
      ctrlKey: false,
      multiple: true
    });
    const ctrlResult = resolveSelection({
      rows: kRows,
      clickedId: "b",
      current: ["a1"],
      anchorId: "a1",
      shiftKey: false,
      ctrlKey: true,
      multiple: true
    });

    assert.deepEqual(shiftResult, { selected: ["a1"], anchorId: "a1" });
    assert.deepEqual(ctrlResult, { selected: ["a1"], anchorId: "a1" });
  });
});
