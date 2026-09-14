// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { TreeNode } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  collectTreeNodeIds,
  insertAfterTreeNode,
  insertChildTreeNode,
  relabelTreeNode,
  removeTreeNode
} from "#src/app/treeNodes.ts";

describe("insertChildTreeNode", () => {
  test("appends at the root when parentId is null", () => {
    const nodes: TreeNode[] = [{ id: "a", label: "Block" }];

    const result = insertChildTreeNode(nodes, null, { id: "b", label: "Sphere" });

    assert.deepStrictEqual(result, [
      { id: "a", label: "Block" },
      { id: "b", label: "Sphere" }
    ]);
  });

  test("nests the new node under a root parent without children", () => {
    const nodes: TreeNode[] = [{ id: "a", label: "Block" }];

    const result = insertChildTreeNode(nodes, "a", { id: "b", label: "Sphere" });

    assert.deepStrictEqual(result, [
      { id: "a", label: "Block", children: [{ id: "b", label: "Sphere" }] }
    ]);
  });

  test("appends after existing children of a nested parent", () => {
    const nodes: TreeNode[] = [
      {
        id: "root",
        label: "Root",
        children: [{ id: "arm", label: "Arm" }]
      }
    ];

    const result = insertChildTreeNode(nodes, "root", { id: "leg", label: "Leg" });

    assert.deepStrictEqual(result, [
      {
        id: "root",
        label: "Root",
        children: [
          { id: "arm", label: "Arm" },
          { id: "leg", label: "Leg" }
        ]
      }
    ]);
  });

  test("returns an equivalent tree when parentId is not found", () => {
    const nodes: TreeNode[] = [{ id: "a", label: "Block" }];

    const result = insertChildTreeNode(nodes, "missing", { id: "b", label: "Sphere" });

    assert.deepStrictEqual(result, nodes);
  });
});

describe("insertAfterTreeNode", () => {
  test("inserts right after the sibling at the root", () => {
    const nodes: TreeNode[] = [
      { id: "a", label: "Block" },
      { id: "c", label: "Sphere" }
    ];

    const result = insertAfterTreeNode(nodes, "a", { id: "b", label: "Block Copy" });

    assert.deepStrictEqual(result, [
      { id: "a", label: "Block" },
      { id: "b", label: "Block Copy" },
      { id: "c", label: "Sphere" }
    ]);
  });

  test("inserts after a nested sibling while preserving its ancestors", () => {
    const nodes: TreeNode[] = [
      {
        id: "root",
        label: "Root",
        children: [{ id: "arm", label: "Arm" }]
      }
    ];

    const result = insertAfterTreeNode(nodes, "arm", { id: "arm-copy", label: "Arm Copy" });

    assert.deepStrictEqual(result, [
      {
        id: "root",
        label: "Root",
        children: [
          { id: "arm", label: "Arm" },
          { id: "arm-copy", label: "Arm Copy" }
        ]
      }
    ]);
  });

  test("returns an equivalent tree when siblingId is not found", () => {
    const nodes: TreeNode[] = [{ id: "a", label: "Block" }];

    const result = insertAfterTreeNode(nodes, "missing", { id: "b", label: "Sphere" });

    assert.deepStrictEqual(result, nodes);
  });
});

describe("removeTreeNode", () => {
  test("removes a root node without touching its siblings", () => {
    const nodes: TreeNode[] = [
      { id: "a", label: "Block" },
      { id: "b", label: "Sphere" }
    ];

    const result = removeTreeNode(nodes, "a");

    assert.deepStrictEqual(result, [{ id: "b", label: "Sphere" }]);
  });

  test("removes a nested node along with its whole subtree", () => {
    const nodes: TreeNode[] = [
      {
        id: "root",
        label: "Root",
        children: [
          {
            id: "arm",
            label: "Arm",
            children: [{ id: "hand", label: "Hand" }]
          },
          { id: "leg", label: "Leg" }
        ]
      }
    ];

    const result = removeTreeNode(nodes, "arm");

    assert.deepStrictEqual(result, [
      {
        id: "root",
        label: "Root",
        children: [{ id: "leg", label: "Leg" }]
      }
    ]);
  });

  test("collapses an emptied children array back to undefined", () => {
    const nodes: TreeNode[] = [
      {
        id: "root",
        label: "Root",
        children: [{ id: "arm", label: "Arm" }]
      }
    ];

    const result = removeTreeNode(nodes, "arm");

    assert.deepStrictEqual(result, [{ id: "root", label: "Root", children: undefined }]);
  });

  test("returns an equivalent tree when the id is not found", () => {
    const nodes: TreeNode[] = [{ id: "a", label: "Block" }];

    const result = removeTreeNode(nodes, "missing");

    assert.deepStrictEqual(result, nodes);
  });
});

describe("relabelTreeNode", () => {
  test("relabels a root node without touching its siblings", () => {
    const nodes: TreeNode[] = [
      { id: "a", label: "Cube" },
      { id: "b", label: "Sphere" }
    ];

    const result = relabelTreeNode(nodes, "a", "Torso");

    assert.deepStrictEqual(result, [
      { id: "a", label: "Torso" },
      { id: "b", label: "Sphere" }
    ]);
  });

  test("relabels a nested node while preserving its ancestors and children", () => {
    const nodes: TreeNode[] = [
      {
        id: "root",
        label: "Root",
        children: [
          {
            id: "arm",
            label: "Arm",
            children: [{ id: "hand", label: "Hand" }]
          }
        ]
      }
    ];

    const result = relabelTreeNode(nodes, "arm", "Left Arm");

    assert.deepStrictEqual(result, [
      {
        id: "root",
        label: "Root",
        children: [
          {
            id: "arm",
            label: "Left Arm",
            children: [{ id: "hand", label: "Hand" }]
          }
        ]
      }
    ]);
  });

  test("returns an equivalent tree when the id is not found", () => {
    const nodes: TreeNode[] = [{ id: "a", label: "Cube" }];

    const result = relabelTreeNode(nodes, "missing", "Torso");

    assert.deepStrictEqual(result, nodes);
  });
});

describe("collectTreeNodeIds", () => {
  test("returns only the node's own id when it has no children", () => {
    const node: TreeNode = { id: "a", label: "Block" };

    assert.deepStrictEqual(collectTreeNodeIds(node), ["a"]);
  });

  test("returns the node's id followed by every descendant id", () => {
    const node: TreeNode = {
      id: "root",
      label: "Root",
      children: [
        {
          id: "arm",
          label: "Arm",
          children: [{ id: "hand", label: "Hand" }]
        },
        { id: "leg", label: "Leg" }
      ]
    };

    assert.deepStrictEqual(
      collectTreeNodeIds(node),
      ["root", "arm", "hand", "leg"]
    );
  });
});
