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
const kOtherScene = { id: "scene-2", kind: "scene" };

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
    ["an instance of another scene", {
      action: "actor-added",
      actors: [actor("D", { prefab: kOtherScene })]
    }, true],
    ["an instance of the scene itself", {
      action: "actor-added",
      actors: [actor("D", { prefab: { id: "scene-1", kind: "scene" } })]
    }, false],
    ["a prefab that is not a scene", {
      action: "actor-added",
      actors: [actor("D", { prefab: { id: "map-1", kind: "voxelmap" } })]
    }, false],
    ["an instance with components", {
      action: "actor-added",
      actors: [actor("D", { prefab: kOtherScene, components: [component("c")] })]
    }, false],
    ["a subtree with a child under its instance", {
      action: "actor-added",
      actors: [actor("D", { prefab: kOtherScene }), actor("E", { parentId: "D" })]
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
    ["a move before an actor of another parent", {
      action: "actor-moved",
      id: "C",
      parentId: null,
      transform: kTransform,
      beforeId: "B"
    }, false],
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
      assert.equal(loadedTree(sampleActors(), { sceneId: "scene-1" }).accepts(command), expected);
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

describe("SceneTree.ancestorIds", () => {
  test("walks from an actor's parent up to its root", () => {
    const tree = loadedTree([...sampleActors(), actor("D", { parentId: "B" })]);

    assert.deepEqual([...tree.ancestorIds("D")], ["B", "A"]);
    assert.deepEqual([...tree.ancestorIds("A")], []);
    assert.deepEqual([...tree.ancestorIds("missing")], []);
  });
});

describe("SceneTree.copySubtree", () => {
  test("gives every actor and component a new id and keeps the copy's parent links", () => {
    const tree = loadedTree([...sampleActors(), actor("D", { parentId: "B" })]);

    const [root, child, grandChild] = tree.copySubtree("A");

    assert.deepEqual(
      [root.name, child.name, grandChild.name],
      ["A (1)", "B", "D"]
    );
    assert.ok([root, child, grandChild].every(({ id }) => !tree.has(id)));
    assert.strictEqual(root.parentId, null);
    assert.strictEqual(child.parentId, root.id);
    assert.strictEqual(grandChild.parentId, child.id);
    assert.ok(root.components.every(({ id }) => tree.componentOwner(id) === undefined));
    assert.deepEqual(root.components[0].data, { intensity: 1, color: "#ffffff" });
  });

  test("numbers the copy of a copy after its source's count", () => {
    const tree = loadedTree([actor("A", { name: "Box (1)" })]);

    assert.strictEqual(tree.copySubtree("A")[0].name, "Box (2)");
    assert.deepEqual(tree.copySubtree("missing"), []);
  });

  test("skips copy names a sibling already uses", () => {
    const tree = loadedTree([
      actor("A", { name: "Box" }),
      actor("B", { name: "Box (1)" }),
      actor("C", { name: "Box (2)", parentId: "A" })
    ]);

    assert.strictEqual(tree.copySubtree("A")[0].name, "Box (2)");
  });
});

describe("SceneTree.topmostIds", () => {
  test("keeps the existing ids with no listed ancestor, in tree order", () => {
    const tree = loadedTree([...sampleActors(), actor("D", { parentId: "B" })]);

    assert.deepEqual(tree.topmostIds(["D", "C", "missing", "A"]), ["A", "C"]);
    assert.deepEqual(tree.topmostIds(["D", "B"]), ["B"]);
  });
});
