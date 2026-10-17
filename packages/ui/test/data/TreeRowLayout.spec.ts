// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { TreeNode } from "../../src/data/tree/contract.ts";
import { TreeSnapshot } from "../../src/data/tree/model.ts";
import {
  TreeRowLayout,
  type TreeRail
} from "../../src/data/tree/TreeRowLayout.ts";
import {
  FOLDER_TREE,
  TREE
} from "../fixtures/tree.ts";

// CONSTANTS
const kNested: TreeNode[] = [
  {
    id: "root",
    label: "Root",
    children: [
      {
        id: "open",
        label: "Open",
        children: [{ id: "leaf", label: "Leaf" }]
      },
      { id: "middle", label: "Middle" },
      {
        id: "last",
        label: "Last",
        children: [{ id: "tail", label: "Tail" }]
      }
    ]
  }
];
const kNestedIds = ["root", "open", "leaf", "middle", "last", "tail"];

function createLayout(
  nodes: TreeNode[],
  expanded: string[] = []
): TreeRowLayout {
  const expandedIds = new Set(expanded);

  return new TreeRowLayout(new TreeSnapshot(nodes, expandedIds), expandedIds);
}

function readRails(
  layout: TreeRowLayout,
  scope: "all" | "selected"
): (readonly TreeRail[])[] {
  return kNestedIds.map((id) => layout.rails(id, scope));
}

describe("Data.TreeRowLayout", () => {
  test("rails carry one level per ancestor and end the line at the last child", () => {
    const layout = createLayout(kNested, ["root", "open"]);

    assert.deepEqual(readRails(layout, "all"), [
      ["start"],
      ["tee", "start"],
      ["line", "elbow"],
      ["tee"],
      ["elbow"],
      ["blank", "elbow"]
    ]);
  });

  test("selected rails draw only the path from each selected row to its ancestors", () => {
    const layout = createLayout(kNested, ["root", "open", "last"]);
    layout.follow(["leaf"]);

    assert.deepEqual(readRails(layout, "selected"), [
      ["start"],
      ["elbow", "start"],
      ["blank", "elbow"],
      [],
      [],
      []
    ]);

    layout.follow(["open", "tail"]);
    assert.deepEqual(readRails(layout, "selected"), [
      ["start"],
      ["tee"],
      ["line", "blank"],
      ["line"],
      ["elbow", "start"],
      ["blank", "elbow"]
    ]);
  });

  test("an unknown row has no rails", () => {
    assert.deepEqual(createLayout(TREE).rails("missing"), []);
  });

  test("a leaf reserves the toggle width only beside a branch sibling", () => {
    const tree = createLayout(TREE);
    const folders = createLayout(FOLDER_TREE);

    assert.equal(tree.spacer("a1", false), "inside");
    assert.equal(tree.spacer("b", true), "outside");
    assert.equal(tree.spacer("a", false), "none");
    assert.equal(tree.spacer("a2a", false), "none");
    assert.equal(folders.spacer("c1", false), "none");
    assert.equal(folders.spacer("missing", false), "none");
  });
});
