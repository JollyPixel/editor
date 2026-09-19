// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { PresencePeer } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  collectExpandableIds,
  toTreeNodes
} from "#src/features/hierarchy/hierarchyTreeNodes.ts";
import type { HierarchyNode } from "#src/model/index.ts";

function node(
  id: string,
  kind: HierarchyNode["kind"],
  children: HierarchyNode[] = []
): HierarchyNode {
  return { id, name: id, kind, children };
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
  test("maps names to renamable labels and gives folders the folder icon", () => {
    const nodes = toTreeNodes([node("limbs", "folder", [node("arm", "block")])], new Map());

    assert.deepEqual(nodes, [{
      id: "limbs",
      label: "limbs",
      renamable: true,
      icon: "folder",
      children: [{ id: "arm", label: "arm", renamable: true }]
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
