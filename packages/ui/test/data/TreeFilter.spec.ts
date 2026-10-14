// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { TreeNode } from "../../src/data/tree/contract.ts";
import { TreeFilter } from "../../src/data/tree/TreeFilter.ts";
import {
  TreeSnapshot,
  isExpandable
} from "../../src/data/tree/model.ts";
import { SearchQuery } from "../../src/search/SearchQuery.ts";

// CONSTANTS
const kScene: TreeNode[] = [
  {
    id: "scene",
    label: "Scene",
    children: [
      {
        id: "props",
        label: "Props",
        children: [
          { id: "crate", label: "Crate" },
          { id: "barrel", label: "Barrel" },
          { id: "lamp", label: "Lamp" }
        ]
      },
      {
        id: "lights",
        label: "Lights",
        children: [{ id: "sun", label: "Sun" }]
      },
      { id: "camera", label: "Camera" }
    ]
  }
];

function visibleIds(
  text: string,
  expanded: string[] = []
): string[] {
  const filter = new TreeFilter(kScene, new SearchQuery(text));

  return new TreeSnapshot(filter.nodes, new Set(expanded))
    .visibleRows
    .map((row) => row.node.id);
}

describe("TreeFilter", () => {
  test("an empty query keeps the nodes as given", () => {
    const filter = new TreeFilter(kScene, SearchQuery.EMPTY);

    assert.equal(filter.nodes, kScene);
    assert.equal(filter.matches.size, 0);
  });

  test("shows each match under its collapsed ancestors", () => {
    assert.deepEqual(
      visibleIds("rel"),
      ["scene", "props", "barrel"]
    );
  });

  test("a matching branch keeps its whole subtree under the user's expansion", () => {
    assert.deepEqual(visibleIds("lights"), ["scene", "lights"]);
    assert.deepEqual(
      visibleIds("lights", ["lights"]),
      ["scene", "lights", "sun"]
    );
  });

  test("reveals a match nested in a matching branch and leaves its siblings collapsed", () => {
    assert.deepEqual(
      visibleIds("n"),
      ["scene", "props", "lights", "sun", "camera"]
    );
  });

  test("pins the ancestors of a match open and leaves a matching branch collapsible", () => {
    const [scene] = new TreeFilter(kScene, new SearchQuery("props")).nodes;
    const [props] = scene.children ?? [];

    assert.equal(isExpandable(scene), false);
    assert.equal(isExpandable(props), true);
  });

  test("records where each label matches, inside a matching branch too", () => {
    const filter = new TreeFilter(kScene, new SearchQuery("e"));

    assert.deepEqual([...filter.matches.keys()].sort(), ["barrel", "camera", "crate", "scene"]);
    assert.deepEqual(filter.matches.get("crate"), { start: 4, end: 5 });
  });

  test("leaves the caller's nodes untouched", () => {
    new TreeFilter(kScene, new SearchQuery("sun"));

    assert.equal(kScene[0].collapsible, undefined);
    assert.equal(kScene[0].children?.length, 3);
  });

  test("numbers kept siblings among themselves", () => {
    const filter = new TreeFilter(kScene, new SearchQuery("lamp"));
    const snapshot = new TreeSnapshot(filter.nodes);

    assert.deepEqual(snapshot.placement("lamp"), {
      position: 1,
      size: 1,
      levelHasBranches: false
    });
  });

  test("no match leaves no rows", () => {
    assert.deepEqual(visibleIds("zebra"), []);
  });
});
