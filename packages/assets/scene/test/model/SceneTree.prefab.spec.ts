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
  component,
  loadedTree,
  sampleActors
} from "../helpers/scene.ts";

// CONSTANTS
const kTransform = SceneTransform.create();
const kOtherScene = { id: "scene-2", kind: "scene" };

describe("SceneTree.accepts around a prefab instance", () => {
  const cases: [string, SceneCommand, boolean][] = [
    ["an actor added under the instance", {
      action: "actor-added",
      actors: [actor("D", { parentId: "P" })]
    }, false],
    ["a move under the instance", {
      action: "actor-moved",
      id: "C",
      parentId: "P",
      transform: kTransform
    }, false],
    ["a move of the instance under an actor", {
      action: "actor-moved",
      id: "P",
      parentId: "A",
      transform: kTransform
    }, true],
    ["a component added to the instance", {
      action: "component-added",
      actorId: "P",
      component: component("c")
    }, false]
  ];

  for (const [name, command, expected] of cases) {
    test(`${expected ? "accepts" : "refuses"} ${name}`, () => {
      const tree = loadedTree([...sampleActors(), actor("P", { prefab: kOtherScene })]);

      assert.equal(tree.accepts(command), expected);
    });
  }
});
