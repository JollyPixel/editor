// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { PresencePeer } from "@jolly-pixel/ui";
import { MaterialSurface } from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import {
  collectExpandableIds,
  toTreeNodes
} from "#src/features/hierarchy/hierarchyTreeNodes.ts";
import type { HierarchyNode } from "#src/model/index.ts";
import { materialSwatch } from "#src/features/material/materialSwatch.ts";

function allVisible(): boolean {
  return true;
}

function node(
  id: string,
  kind: HierarchyNode["kind"],
  children: HierarchyNode[] = []
): HierarchyNode {
  return { id, name: id, kind, material: null, children };
}

function peer(
  clientId: string
): PresencePeer {
  return {
    clientId,
    displayName: clientId.toUpperCase(),
    color: `#${clientId.repeat(6).slice(0, 6)}`
  };
}

describe("toTreeNodes", () => {
  test("gives folders the folder icon and blocks their material swatch", () => {
    const glass = {
      kind: "material" as const,
      id: "glass",
      parentId: null,
      name: "Glass",
      surface: MaterialSurface.create({ opacity: 0.4 })
    };
    const nodes = toTreeNodes([node("limbs", "folder", [
      node("arm", "block"),
      { ...node("leg", "block"), material: glass }
    ])], new Map(), (id) => id !== "leg");

    assert.deepEqual(nodes, [{
      id: "limbs",
      label: "limbs",
      renamable: true,
      icon: "folder",
      visible: true,
      children: [
        { id: "arm", label: "arm", renamable: true, swatch: materialSwatch(null), visible: true },
        { id: "leg", label: "leg", renamable: true, swatch: materialSwatch(glass), visible: false }
      ]
    }]);
  });

  test("turns a name clash into a row warning", () => {
    const [clashing, plain] = toTreeNodes([
      { ...node("arm", "block"), nameClash: "Another root block is named \"arm\"" },
      node("leg", "block")
    ], new Map(), allVisible);

    assert.equal(clashing.warning, "Another root block is named \"arm\"");
    assert.equal("warning" in plain, false);
  });

  test("shows a folder visible while any block under it is, at any depth", () => {
    const tree = [
      node("outer", "folder", [
        node("inner", "folder", [node("hand", "block", [node("finger", "block")])]),
        node("arm", "block")
      ]),
      node("empty", "folder")
    ];

    const [outer, empty] = toTreeNodes(tree, new Map(), (id) => id === "finger");
    assert.equal(outer.visible, true);
    assert.equal(outer.children?.[0].visible, true);
    assert.equal(empty.visible, undefined);

    const [hidden] = toTreeNodes(tree, new Map(), (id) => id === "arm");
    assert.equal(hidden.visible, true);
    assert.equal(hidden.children?.[0].visible, false);
  });

  test("stamps up to three peer badges on the matching node, at any depth", () => {
    const marks = new Map([["arm", ["a", "b", "c", "d"].map(peer)]]);

    const [root] = toTreeNodes([node("body", "block", [node("arm", "block")])], marks, allVisible);

    assert.equal(root.badges, undefined);
    assert.deepEqual(root.children?.[0].badges, [
      { color: "#aaaaaa", title: "A" },
      { color: "#bbbbbb", title: "B" },
      { color: "#cccccc", title: "C" }
    ]);
  });
});

describe("collectExpandableIds", () => {
  test("returns an empty list when no node has children", () => {
    assert.deepEqual(collectExpandableIds(toTreeNodes([node("a", "block")], new Map(), allVisible)), []);
  });

  test("returns every ancestor id, root to leaf, skipping childless nodes", () => {
    const tree = toTreeNodes([
      node("root", "block", [
        node("middle", "folder", [node("leaf", "block")]),
        node("sibling", "block")
      ])
    ], new Map(), allVisible);

    assert.deepEqual(collectExpandableIds(tree), ["root", "middle"]);
  });
});
