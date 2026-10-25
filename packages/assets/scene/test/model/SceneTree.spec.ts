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
  sampleActors,
  treeIds
} from "../helpers/scene.ts";

// CONSTANTS
const kTransform = SceneTransform.create();
const kOversized = { text: "x".repeat(COMPONENT_DATA_MAX_LENGTH) };

describe("SceneTree.accepts", () => {
  const cases: [string, SceneCommand, boolean][] = [
    ["a subtree under an actor before its child", {
      action: "actor-added",
      actors: [actor("D", { parentId: "A" }), actor("E", { parentId: "D" })],
      beforeId: "B"
    }, true],
    ["an actor whose id exists", {
      action: "actor-added",
      actors: [actor("B")]
    }, false],
    ["a subtree whose descendant hangs outside it", {
      action: "actor-added",
      actors: [actor("D"), actor("E", { parentId: "C" })]
    }, false],
    ["a prefab instance", {
      action: "actor-added",
      actors: [actor("D", { prefab: { id: "scene-2", kind: "scene" } })]
    }, false],
    ["an actor placed before an actor of another parent", {
      action: "actor-added",
      actors: [actor("D")],
      beforeId: "B"
    }, false],
    ["a component with data over the size limit", {
      action: "component-added",
      actorId: "C",
      component: component("big", kOversized)
    }, false],
    ["a move under its own descendant", {
      action: "actor-moved",
      id: "A",
      parentId: "B",
      transform: kTransform
    }, false],
    ["a move under an unknown actor", {
      action: "actor-moved",
      id: "C",
      parentId: "missing",
      transform: kTransform
    }, false],
    ["a move to the root before a root actor", {
      action: "actor-moved",
      id: "B",
      parentId: null,
      transform: kTransform,
      beforeId: "C"
    }, true],
    ["a component id already used", {
      action: "component-added",
      actorId: "C",
      component: component("light")
    }, false],
    ["a component removal naming another actor", {
      action: "component-removed",
      actorId: "B",
      id: "light"
    }, false],
    ["a component change with no field", {
      action: "component-changed",
      id: "light",
      data: {}
    }, false],
    ["a component change that sets and unsets one field", {
      action: "component-changed",
      id: "light",
      data: { intensity: 2 },
      unset: ["intensity"]
    }, false],
    ["a component change growing data over the size limit", {
      action: "component-changed",
      id: "light",
      data: kOversized
    }, false]
  ];

  for (const [name, command, expected] of cases) {
    test(`${expected ? "accepts" : "refuses"} ${name}`, () => {
      assert.equal(loadedTree(sampleActors()).accepts(command), expected);
    });
  }
});

describe("SceneTree.apply", () => {
  test("lands an added subtree before its sibling, in tree order", () => {
    const tree = loadedTree(sampleActors());

    tree.apply({
      action: "actor-added",
      actors: [actor("D", { parentId: "A" }), actor("E", { parentId: "D" })],
      beforeId: "B"
    });

    assert.deepEqual(treeIds(tree), ["A", "D", "E", "B", "C"]);
    assert.deepEqual(tree.toJSON().actors.map(({ id }) => id), ["A", "D", "E", "B", "C"]);
  });

  test("removes an actor with its subtree and frees its component ids", () => {
    const tree = loadedTree(sampleActors());

    tree.apply({ action: "actor-removed", id: "A" });

    assert.deepEqual(treeIds(tree), ["C"]);
    assert.equal(tree.accepts({
      action: "component-added",
      actorId: "C",
      component: component("light")
    }), true);
  });

  test("moves an actor to its new parent, place and transform", () => {
    const tree = loadedTree(sampleActors());
    const transform = SceneTransform.create({ position: { x: 3, y: 0, z: 0 } });

    tree.apply({ action: "actor-moved", id: "C", parentId: "A", transform, beforeId: "B" });

    assert.deepEqual(treeIds(tree), ["A", "C", "B"]);
    assert.deepEqual(tree.actor("C")?.transform, transform);
  });

  test("patches only the transform fields a command names", () => {
    const tree = loadedTree(sampleActors());
    const scale = { x: 2, y: 2, z: 2 };

    tree.apply({ action: "actor-transformed", id: "C", transform: { scale } });

    assert.deepEqual(tree.actor("C")?.transform, SceneTransform.create({ scale }));
  });

  test("merges top-level component fields and removes unset ones", () => {
    const tree = loadedTree(sampleActors());

    tree.apply({
      action: "component-changed",
      id: "light",
      data: { intensity: 2, shadow: { bias: 0.1 } },
      unset: ["color"]
    });

    assert.deepEqual(tree.component("light")?.data, {
      intensity: 2,
      shadow: { bias: 0.1 }
    });
  });

  test("reorders components within their actor", () => {
    const tree = loadedTree([
      actor("A", { components: [component("c1"), component("c2"), component("c3")] })
    ]);

    tree.apply({ action: "component-moved", actorId: "A", id: "c3", beforeId: "c1" });

    assert.deepEqual(tree.actor("A")?.components.map(({ id }) => id), ["c3", "c1", "c2"]);
  });

  test("fills and clears asset slots without touching the others", () => {
    const map = { id: "map-1", kind: "voxelmap" };
    const tree = loadedTree([
      actor("A", { components: [component("c", {}, { map: null, texture: map })] })
    ]);

    tree.apply({
      action: "component-assets-changed",
      id: "c",
      assets: { map, texture: null }
    });

    assert.deepEqual(tree.component("c")?.assets, { map, texture: null });
  });

  test("patches the environment fields a command names", () => {
    const tree = loadedTree([]);

    tree.apply({ action: "environment-changed", environment: { background: "#102030" } });

    assert.deepEqual(tree.environment, {
      ...loadedTree([]).environment,
      background: "#102030"
    });
  });
});

describe("SceneTree.placeable", () => {
  test("drops a before id that no longer names a sibling", () => {
    const tree = loadedTree(sampleActors());

    assert.deepEqual(
      tree.placeable({ action: "actor-added", actors: [actor("D")], beforeId: "B" }),
      { action: "actor-added", actors: [actor("D")] }
    );
  });
});
