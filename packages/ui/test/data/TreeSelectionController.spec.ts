// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type {
  JollySelectDetail,
  TreeNode
} from "../../src/data/tree/contract.ts";
import { idleTreeInteraction } from "../../src/data/tree/interaction.ts";
import { flattenVisible } from "../../src/data/tree/model.ts";
import { TreeSelectionController } from "../../src/data/tree/TreeSelectionController.ts";

// CONSTANTS
const kTree: TreeNode[] = [
  { id: "a", label: "A" },
  { id: "b", label: "B" },
  { id: "c", label: "C" }
];
const kRows = flattenVisible(kTree, new Set());

function createSelection() {
  const host = document.createElement("div");
  const details: JollySelectDetail[] = [];
  let selected: string[] = [];
  host.addEventListener("jolly-select", ({ detail }) => {
    details.push(detail);
    selected = detail.selected;
  });
  const controller = new TreeSelectionController(host, {
    visibleRows: () => kRows,
    selected: () => selected,
    multiple: () => true,
    requireSelection: () => false,
    interaction: () => idleTreeInteraction(),
    switchInteraction: () => undefined
  });
  host.addEventListener("click", (event) => controller.onRowsClick(event));

  return { host, controller, details };
}

describe("TreeSelectionController", () => {
  test("names the row a click acted on, even when a range selects others with it", () => {
    const { controller, details } = createSelection();

    controller.onRowClick(new PointerEvent("click"), "a");
    controller.onRowClick(new PointerEvent("click", { shiftKey: true }), "c");

    assert.deepEqual(details, [
      { selected: ["a"], id: "a" },
      { selected: ["a", "b", "c"], id: "c" }
    ]);
  });

  test("names no row when a click on the empty area clears the selection", () => {
    const { host, controller, details } = createSelection();
    controller.selectSingle("b");

    host.dispatchEvent(new PointerEvent("click"));

    assert.deepEqual(details, [
      { selected: ["b"], id: "b" },
      { selected: [], id: null }
    ]);
  });
});
