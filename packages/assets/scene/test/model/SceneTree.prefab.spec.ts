// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  COMPONENT_DATA_MAX_LENGTH,
  SceneTransform
} from "#src/index.ts";
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
    }, false],
    ["a component whose id has a path separator", {
      action: "component-added",
      actorId: "A",
      component: component("A/c")
    }, false],
    ["an override of an actor inside the instance", {
      action: "actor-overridden",
      id: "P",
      path: "room/door",
      set: { name: "Front door" }
    }, true],
    ["an override on an actor that is no instance", {
      action: "actor-overridden",
      id: "A",
      path: "door",
      set: { name: "Front door" }
    }, false],
    ["an override that touches no field", {
      action: "component-overridden",
      id: "P",
      path: "lamp",
      set: { data: {} }
    }, false],
    ["an override that sets and unsets one field", {
      action: "component-overridden",
      id: "P",
      path: "lamp",
      set: { data: { intensity: 2 } },
      unset: { data: ["intensity"] }
    }, false],
    ["overrides over the size limit", {
      action: "component-overridden",
      id: "P",
      path: "lamp",
      set: { data: { text: "x".repeat(COMPONENT_DATA_MAX_LENGTH) } }
    }, false]
  ];

  for (const [name, command, expected] of cases) {
    test(`${expected ? "accepts" : "refuses"} ${name}`, () => {
      const tree = loadedTree([...sampleActors(), actor("P", { prefab: kOtherScene })]);

      assert.equal(tree.accepts(command), expected);
    });
  }
});

describe("SceneTree.apply of an override", () => {
  test("merges fields into the instance overrides and drops what nothing overrides any more", () => {
    const tree = loadedTree([actor("P", { prefab: kOtherScene })]);

    tree.apply({ action: "actor-overridden", id: "P", path: "door", set: { name: "Front door" } });
    tree.apply({
      action: "actor-overridden",
      id: "P",
      path: "door",
      set: { transform: { scale: { x: 2, y: 2, z: 2 } } }
    });
    tree.apply({ action: "component-overridden", id: "P", path: "lamp", set: { data: { intensity: 2 } } });

    assert.deepEqual(tree.actor("P")?.overrides, {
      actors: { door: { name: "Front door", transform: { scale: { x: 2, y: 2, z: 2 } } } },
      components: { lamp: { data: { intensity: 2 } } }
    });

    tree.apply({ action: "actor-overridden", id: "P", path: "door", unset: ["name", "scale"] });
    tree.apply({ action: "component-overridden", id: "P", path: "lamp", unset: { data: ["intensity"] } });

    assert.equal(tree.actor("P")?.overrides, undefined);
  });
});
