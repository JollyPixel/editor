// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { CommandHistory } from "@jolly-pixel/history";

// Import Internal Dependencies
import {
  SceneDocument,
  sceneHistoryRegistration,
  SceneTransform
} from "#src/index.ts";
import {
  actor,
  component,
  sampleActors,
  snapshot
} from "../helpers/scene.ts";

// CONSTANTS
const kScope = "scene";

function setup() {
  const document = new SceneDocument();
  document.load(snapshot(sampleActors()));
  const history = new CommandHistory<typeof kScope>();
  history.register(sceneHistoryRegistration(document, { scope: kScope }));

  return {
    document,
    history
  };
}

describe("scene history", () => {
  const edits: [string, (document: SceneDocument) => unknown][] = [
    ["adding an actor", (document) => document.addActor({
      id: "D",
      name: "D",
      parentId: "A",
      beforeId: "B",
      components: [component("d1")]
    })],
    ["removing an actor with children", (document) => document.remove("A")],
    ["moving an actor", (document) => document.move("C", "A", {
      transform: SceneTransform.create({ position: { x: 1, y: 2, z: 3 } }),
      beforeId: "B"
    })],
    ["renaming an actor", (document) => document.rename("B", "Bee")],
    ["hiding an actor", (document) => document.changeVisibility("B", false)],
    ["transforming an actor", (document) => document.transform("C", {
      rotation: { x: 0, y: 90, z: 0 }
    })],
    ["adding a component", (document) => document.addComponent("B", {
      id: "c2",
      type: "Mesh"
    })],
    ["removing a component", (document) => document.removeComponent("light")],
    ["reordering a component", (document) => document.moveComponent("mesh", "light")],
    ["changing and unsetting component fields", (document) => document.changeComponent("light", {
      data: { intensity: 3, range: 5 },
      unset: ["color"]
    })],
    ["filling an asset slot", (document) => document.changeComponentAssets("light", {
      cookie: { id: "texture-1", kind: "pixelart" }
    })],
    ["changing the environment", (document) => document.changeEnvironment({
      fog: { kind: "exp2", color: "#ffffff", density: 0.1 }
    })]
  ];

  for (const [name, edit] of edits) {
    test(`undo and redo of ${name} restore each side`, () => {
      const { document, history } = setup();
      const before = document.tree.toJSON();

      history.record(kScope, null, () => assert.ok(edit(document)));
      const after = document.tree.toJSON();

      assert.ok(history.undo(kScope));
      assert.deepEqual(document.tree.toJSON(), before);
      assert.ok(history.redo(kScope));
      assert.deepEqual(document.tree.toJSON(), after);
    });
  }

  test("refuses to undo an actor added before a peer edited its component", () => {
    const { document, history } = setup();
    history.record(kScope, null, () => document.addActor({
      id: "D",
      name: "D",
      components: [component("d1", { intensity: 1 })]
    }));

    document.applyRemote({ action: "component-changed", id: "d1", data: { intensity: 4 } }, "peer");

    assert.equal(history.undo(kScope), false);
    assert.equal(document.tree.has("D"), true);
  });

  test("refuses to undo an actor added before a peer put a child under it", () => {
    const { document, history } = setup();
    history.record(kScope, null, () => document.addActor({ id: "D", name: "D" }));

    document.applyRemote({ action: "actor-added", actors: [actor("E", { parentId: "D" })] }, "peer");

    assert.equal(history.undo(kScope), false);
    assert.equal(document.tree.has("D"), true);
  });

  test("undoes one component field while keeping a peer's edit of another", () => {
    const { document, history } = setup();
    history.record(kScope, null, () => document.changeComponent("light", {
      data: { intensity: 3 }
    }));

    document.applyRemote({ action: "component-changed", id: "light", data: { color: "#ff0000" } }, "peer");

    assert.ok(history.undo(kScope));
    assert.deepEqual(document.tree.component("light")?.data, {
      intensity: 1,
      color: "#ff0000"
    });
  });
});
