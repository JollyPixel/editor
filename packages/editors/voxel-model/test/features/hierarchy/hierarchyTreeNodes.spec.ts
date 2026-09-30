// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { PresencePeer } from "@jolly-pixel/ui";
import { createMaterialSurface } from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import {
  collectExpandableIds,
  toTreeNodes
} from "#src/features/hierarchy/hierarchyTreeNodes.ts";
import type { HierarchyNode } from "#src/model/index.ts";
import { materialSwatch } from "#src/shared/materialSwatch.ts";

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
      surface: createMaterialSurface({ opacity: 0.4 })
    };
    const nodes = toTreeNodes([node("limbs", "folder", [
      node("arm", "block"),
      { ...node("leg", "block"), material: glass }
    ])], new Map());

    assert.deepEqual(nodes, [{
      id: "limbs",
      label: "limbs",
      renamable: true,
      icon: "folder",
      children: [
        { id: "arm", label: "arm", renamable: true, swatch: materialSwatch(null) },
        { id: "leg", label: "leg", renamable: true, swatch: materialSwatch(glass) }
      ]
    }]);
  });

  test("stamps up to three peer badges on the matching node, at any depth", () => {
    const marks = new Map([["arm", ["a", "b", "c", "d"].map(peer)]]);

    const [root] = toTreeNodes([node("body", "block", [node("arm", "block")])], marks);

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
    assert.deepEqual(collectExpandableIds(toTreeNodes([node("a", "block")], new Map())), []);
  });

  test("returns every ancestor id, root to leaf, skipping childless nodes", () => {
    const tree = toTreeNodes([
      node("root", "block", [
        node("middle", "folder", [node("leaf", "block")]),
        node("sibling", "block")
      ])
    ], new Map());

    assert.deepEqual(collectExpandableIds(tree), ["root", "middle"]);
  });
});
