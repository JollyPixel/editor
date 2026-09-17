// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { TreeNode } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  buildTreeFromFlatNodes,
  collectTreeNodeIds,
  insertAfterTreeNode,
  insertChildTreeNode,
  isFolderNode,
  mergeFolderTree,
  relabelTreeNode,
  removeTreeNode,
  withBlockBadges
} from "#src/app/treeNodes.ts";
import type { PeerMarkMap } from "#src/collaboration/peerMarks.ts";

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

describe("withBlockBadges", () => {
  test("leaves a node without a mark untouched", () => {
    const nodes: TreeNode[] = [{ id: "a", label: "Block" }];

    const result = withBlockBadges(nodes, new Map());

    assert.deepStrictEqual(result, nodes);
  });

  test("stamps a badge per peer mark on the matching node", () => {
    const nodes: TreeNode[] = [{ id: "a", label: "Block" }];
    const marks: PeerMarkMap<string> = new Map([
      ["a", [
        { clientId: "bob", displayName: "Bob", color: "#00ff00" },
        { clientId: "cleo", displayName: "Cleo", color: "#0000ff" }
      ]]
    ]);

    const result = withBlockBadges(nodes, marks);

    assert.deepStrictEqual(result, [
      {
        id: "a",
        label: "Block",
        badges: [
          { color: "#00ff00", title: "Bob" },
          { color: "#0000ff", title: "Cleo" }
        ]
      }
    ]);
  });

  test("stamps a nested node by its own id", () => {
    const nodes: TreeNode[] = [
      {
        id: "root",
        label: "Root",
        children: [{ id: "arm", label: "Arm" }]
      }
    ];
    const marks: PeerMarkMap<string> = new Map([
      ["arm", [{ clientId: "bob", displayName: "Bob", color: "#00ff00" }]]
    ]);

    const result = withBlockBadges(nodes, marks);

    assert.deepStrictEqual(result, [
      {
        id: "root",
        label: "Root",
        children: [
          {
            id: "arm",
            label: "Arm",
            badges: [{ color: "#00ff00", title: "Bob" }]
          }
        ]
      }
    ]);
  });
});

describe("isFolderNode", () => {
  test("is false for a plain block node", () => {
    assert.equal(isFolderNode({ id: "a", label: "Block" }), false);
  });

  test("is false for a node that merely carries the folder icon", () => {
    assert.equal(isFolderNode({ id: "a", label: "Buildings", icon: "folder" }), false);
  });

  test("is true for a node carrying folder data", () => {
    assert.equal(isFolderNode({ id: "a", label: "Buildings", data: "folder" }), true);
  });
});

describe("buildTreeFromFlatNodes", () => {
  test("nests blocks by parentUuid", () => {
    const result = buildTreeFromFlatNodes([
      { uuid: "child", name: "Arm", parentUuid: "root" },
      { uuid: "root", name: "Torso", parentUuid: null }
    ]);

    assert.deepStrictEqual(result, [
      {
        id: "root",
        label: "Torso",
        renamable: true,
        children: [{ id: "child", label: "Arm", renamable: true }]
      }
    ]);
  });

  test("marks a folder-kind node with the folder icon and default label", () => {
    const result = buildTreeFromFlatNodes([
      { uuid: "f1", name: "", parentUuid: null, kind: "folder" }
    ]);

    assert.deepStrictEqual(result, [
      { id: "f1", label: "Folder", renamable: true, icon: "folder", data: "folder" }
    ]);
  });
});

describe("mergeFolderTree", () => {
  test("nests a placed root block under its folder, leaving unplaced blocks at root", () => {
    const result = mergeFolderTree(
      [
        { uuid: "house", name: "House", parentUuid: null },
        { uuid: "rock", name: "Rock", parentUuid: null }
      ],
      [{ uuid: "buildings", name: "Buildings", parentId: null }],
      [{ blockUuid: "house", folderId: "buildings" }]
    );

    assert.deepStrictEqual(result, [
      {
        id: "buildings",
        label: "Buildings",
        renamable: true,
        icon: "folder",
        data: "folder",
        children: [{ id: "house", label: "House", renamable: true }]
      },
      { id: "rock", label: "Rock", renamable: true }
    ]);
  });

  test("keeps a block's physical nesting when it has no placement", () => {
    const result = mergeFolderTree(
      [
        { uuid: "house", name: "House", parentUuid: null },
        { uuid: "window", name: "Window", parentUuid: "house" }
      ],
      [],
      []
    );

    assert.deepStrictEqual(result, [
      {
        id: "house",
        label: "House",
        renamable: true,
        children: [{ id: "window", label: "Window", renamable: true }]
      }
    ]);
  });

  test("nests folders under folders", () => {
    const result = mergeFolderTree(
      [],
      [
        { uuid: "outer", name: "Outer", parentId: null },
        { uuid: "inner", name: "Inner", parentId: "outer" }
      ],
      []
    );

    assert.deepStrictEqual(result, [
      {
        id: "outer",
        label: "Outer",
        renamable: true,
        icon: "folder",
        data: "folder",
        children: [
          { id: "inner", label: "Inner", renamable: true, icon: "folder", data: "folder" }
        ]
      }
    ]);
  });

  test("nests a folder under a block, alongside the block's own physical children", () => {
    const result = mergeFolderTree(
      [
        { uuid: "house", name: "House", parentUuid: null },
        { uuid: "door", name: "Door", parentUuid: "house" },
        { uuid: "window", name: "Window", parentUuid: null }
      ],
      [{ uuid: "windows", name: "Windows", parentId: "house" }],
      [{ blockUuid: "window", folderId: "windows" }]
    );

    assert.deepStrictEqual(result, [
      {
        id: "house",
        label: "House",
        renamable: true,
        children: [
          {
            id: "windows",
            label: "Windows",
            renamable: true,
            icon: "folder",
            data: "folder",
            children: [{ id: "window", label: "Window", renamable: true }]
          },
          { id: "door", label: "Door", renamable: true }
        ]
      }
    ]);
  });
});
