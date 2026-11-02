// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { SceneTransform } from "#src/index.ts";
import type { SceneCommand } from "#src/network/types.ts";
import {
  actor,
  loadedTree,
  sampleActors
} from "../../helpers/scene.ts";

// CONSTANTS
const kTransform = SceneTransform.create();
const kAnchor = { component: "mesh", key: "object:spawn" };

describe("SceneTree.accepts an anchor", () => {
  const cases: [string, SceneCommand, boolean][] = [
    ["an anchored actor under a parent", {
      action: "actor-added",
      actors: [actor("D", { parentId: "A", anchor: kAnchor })]
    }, true],
    ["an anchored actor at the root", {
      action: "actor-added",
      actors: [actor("D", { anchor: kAnchor })]
    }, false],
    ["a move onto an anchor of the new parent", {
      action: "actor-moved",
      id: "C",
      parentId: "A",
      transform: kTransform,
      anchor: kAnchor
    }, true],
    ["a move onto an anchor at the root", {
      action: "actor-moved",
      id: "B",
      parentId: null,
      transform: kTransform,
      anchor: kAnchor
    }, false]
  ];

  for (const [name, command, expected] of cases) {
    test(`${expected ? "accepts" : "refuses"} ${name}`, () => {
      assert.equal(loadedTree(sampleActors()).accepts(command), expected);
    });
  }
});

describe("SceneTree anchors", () => {
  test("sets the anchor a move names and drops it when a move names none", () => {
    const tree = loadedTree(sampleActors());

    tree.apply({ action: "actor-moved", id: "B", parentId: "A", transform: kTransform, anchor: kAnchor });
    assert.deepEqual(tree.actor("B")?.anchor, kAnchor);

    tree.apply({ action: "actor-moved", id: "B", parentId: "A", transform: kTransform });
    assert.strictEqual(tree.actor("B")?.anchor, undefined);
  });

  test("points a copied anchor at the copy of its component", () => {
    const tree = loadedTree([
      ...sampleActors(),
      actor("D", { parentId: "A", anchor: kAnchor }),
      actor("E", { parentId: "D", anchor: { component: "elsewhere", key: "layer:1" } })
    ]);

    const [root, , anchored, outside] = tree.copySubtree("A");

    assert.deepEqual(anchored.anchor, {
      component: root.components[1].id,
      key: "object:spawn"
    });
    assert.deepEqual(outside.anchor, { component: "elsewhere", key: "layer:1" });
  });
});
