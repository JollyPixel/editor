// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { SceneCommand } from "#src/network/types.ts";
import {
  component,
  loadedTree,
  sampleActors
} from "../../helpers/scene.ts";

// CONSTANTS
const kConnection = {
  id: "c1",
  signal: "toggled",
  target: "mesh",
  method: "show"
};

describe("SceneTree.accepts a connection", () => {
  const cases: [string, SceneCommand, boolean][] = [
    ["between two components", {
      action: "connection-added",
      componentId: "light",
      connection: kConnection
    }, true],
    ["to a missing component", {
      action: "connection-added",
      componentId: "light",
      connection: { ...kConnection, target: "missing" }
    }, true],
    ["from an unknown component", {
      action: "connection-added",
      componentId: "missing",
      connection: kConnection
    }, false],
    ["removal naming an unknown connection", {
      action: "connection-removed",
      componentId: "light",
      id: "c1"
    }, false]
  ];

  for (const [name, command, expected] of cases) {
    test(`${expected ? "accepts" : "refuses"} a connection ${name}`, () => {
      assert.equal(loadedTree(sampleActors()).accepts(command), expected);
    });
  }
});

describe("SceneTree.apply a connection", () => {
  test("leaves a component with no connections field once its last one is removed", () => {
    const tree = loadedTree(sampleActors());
    tree.apply({ action: "connection-added", componentId: "light", connection: kConnection });

    tree.apply({ action: "connection-removed", componentId: "light", id: "c1" });

    assert.deepEqual(tree.component("light"), sampleActors()[0].components[0]);
  });
});

describe("SceneTree.copySubtree with connections", () => {
  test("points connections inside the copy at the copied components", () => {
    const [a, b, c] = sampleActors();
    const tree = loadedTree([
      a,
      { ...b, components: [component("switch")] },
      { ...c, components: [component("lamp")] }
    ]);
    tree.apply({
      action: "connection-added",
      componentId: "switch",
      connection: { ...kConnection, id: "inner", target: "light" }
    });
    tree.apply({
      action: "connection-added",
      componentId: "switch",
      connection: { ...kConnection, id: "outer", target: "lamp" }
    });

    const [root, child] = tree.copySubtree("A");

    assert.deepEqual(
      child.components[0].connections?.map(({ id, target }) => [id, target]),
      [["inner", root.components[0].id], ["outer", "lamp"]]
    );
  });
});
