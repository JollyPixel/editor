// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type {
  TreeNode,
  TreeReserveToggle
} from "../../src/data/tree/contract.ts";
import { TreeSnapshot } from "../../src/data/tree/model.ts";
import {
  TreeRowLayout,
  type TreeRailAnchor,
  type TreeRailStroke
} from "../../src/data/tree/TreeRowLayout.ts";
import {
  FOLDER_TREE,
  OWNER_TREE,
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
  expanded: string[] = [],
  reserveToggle: TreeReserveToggle = "level"
): TreeRowLayout {
  const expandedIds = new Set(expanded);

  return new TreeRowLayout(
    new TreeSnapshot(nodes, expandedIds, reserveToggle),
    expandedIds
  );
}

function readStrokes(
  layout: TreeRowLayout,
  ids: string[],
  scope: "all" | "selected"
): TreeRailStroke[][] {
  return ids.map(
    (id) => layout.rails(id, scope).map((rail) => rail.stroke)
  );
}

function readAnchors(
  layout: TreeRowLayout,
  id: string,
  scope: "all" | "selected"
): TreeRailAnchor[] {
  return layout.rails(id, scope).map((rail) => rail.anchor);
}

describe("Data.TreeRowLayout", () => {
  test("rails carry one level per ancestor and end the line at the last child", () => {
    const layout = createLayout(kNested, ["root", "open"]);

    assert.deepEqual(readStrokes(layout, kNestedIds, "all"), [
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

    assert.deepEqual(readStrokes(layout, kNestedIds, "selected"), [
      ["start"],
      ["elbow", "start"],
      ["blank", "elbow"],
      [],
      [],
      []
    ]);

    layout.follow(["open", "tail"]);
    assert.deepEqual(readStrokes(layout, kNestedIds, "selected"), [
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

  test("a non-collapsible branch beside a toggle drops its line from the reserved width", () => {
    const layout = createLayout(OWNER_TREE, ["folder"]);
    const ids = ["folder", "file", "loose", "owner", "companion"];

    assert.deepEqual(readStrokes(layout, ids, "all"), [
      ["start"],
      ["elbow"],
      [],
      ["blank", "start"],
      ["blank", "elbow"]
    ]);
    layout.follow(["companion"]);
    assert.deepEqual(readStrokes(layout, ids, "selected"), [
      [],
      [],
      [],
      ["blank", "start"],
      ["blank", "elbow"]
    ]);
  });

  test("a non-collapsible branch anchors its children's line under its icon", () => {
    const nested: TreeNode[] = [
      OWNER_TREE[0],
      {
        id: "owner",
        label: "Owner",
        collapsible: false,
        children: [
          {
            id: "companion",
            label: "Companion",
            children: [{ id: "leaf", label: "Leaf" }]
          }
        ]
      }
    ];
    const cases: [string, TreeNode[], TreeReserveToggle, TreeRailAnchor[]][] = [
      ["level, beside a branch", OWNER_TREE, "level", ["toggle", "icon-after-step"]],
      ["tree, beside a branch", OWNER_TREE, "tree", ["icon-after-spacer"]],
      ["level, alone", OWNER_TREE.slice(2), "level", ["icon"]],
      ["tree, alone", OWNER_TREE.slice(2), "tree", ["icon"]],
      ["tree, child has a toggle", nested, "tree", ["toggle"]]
    ];

    for (const [label, nodes, reserveToggle, anchors] of cases) {
      const layout = createLayout(nodes, ["folder"], reserveToggle);
      layout.follow(["companion"]);

      for (const scope of ["all", "selected"] as const) {
        assert.deepEqual(readAnchors(layout, "owner", scope), anchors, label);
        assert.deepEqual(readAnchors(layout, "companion", scope), anchors, label);
      }
    }
    assert.deepEqual(
      readAnchors(createLayout(OWNER_TREE, ["folder"]), "file", "all"),
      ["toggle"]
    );
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

  test("a leaf reserves the toggle width at every level once the tree has a branch", () => {
    const folders = createLayout(FOLDER_TREE, [], "tree");
    const flat = createLayout([{ id: "flat", label: "Flat" }], [], "tree");
    const owners = createLayout(OWNER_TREE.slice(2), [], "tree");

    assert.equal(folders.spacer("c1", false), "inside");
    assert.equal(folders.spacer("r1", true), "outside");
    assert.equal(folders.spacer("r2", false), "none");
    assert.equal(flat.spacer("flat", false), "none");
    assert.equal(owners.spacer("companion", false), "none");
  });
});
