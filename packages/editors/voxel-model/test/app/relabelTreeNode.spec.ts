// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { TreeNode } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { relabelTreeNode } from "#src/app/relabelTreeNode.ts";

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
