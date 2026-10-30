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
  ComponentChange,
  OverrideChange,
  SceneDocument,
  sceneHistoryRegistration,
  SceneTransform,
  type SceneImage
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
  document.load(snapshot([
    ...sampleActors(),
    actor("P", {
      prefab: { id: "house", kind: "scene" },
      overrides: { actors: { door: { name: "Old door" } } }
    })
  ]));
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
    ["moving an actor", (document) => document.move("C", { parentId: "A" }, {
      transform: SceneTransform.create({ position: { x: 1, y: 2, z: 3 } }),
      beforeId: "B"
    })],
    ["moving an actor onto an anchor", (document) => document.move("C", {
      parentId: "A",
      anchor: { component: "mesh", key: "object:spawn" }
    }, {
      transform: SceneTransform.create()
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
    ["changing and unsetting component fields", (document) => document.changeComponent(
      "light",
      new ComponentChange({
        data: { intensity: 3, range: 5 },
        unset: ["color"]
      })
    )],
    ["filling an asset slot", (document) => document.changeComponentAssets("light", {
      cookie: { id: "texture-1", kind: "pixelart" }
    })],
    ["changing the environment", (document) => document.changeEnvironment({
      fog: { kind: "exp2", color: "#ffffff", density: 0.1 }
    })],
    ["overriding and unsetting fields of an inner actor", (document) => document.override(
      OverrideChange.actor({
        id: "P",
        path: "door",
        set: { transform: { position: { x: 1, y: 0, z: 0 } } },
        unset: ["name"]
      })
    )],
    ["overriding a component inside a nested instance", (document) => document.override(
      OverrideChange.component({
        id: "P",
        path: "room/lamp",
        set: {
          data: { intensity: 2 },
          assets: { cookie: { id: "texture-1", kind: "pixelart" } }
        }
      })
    )],
    ["removing a prefab instance with overrides", (document) => document.remove("P")]
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

  test("rewinds pending edits to the actors they found", () => {
    const { document } = setup();
    const before = document.tree.toJSON();
    const images: SceneImage[] = [];
    document.on("change", (change) => images.push(change.image));

    assert.ok(document.rename("B", "Bee"));
    assert.ok(document.transform("B", { position: { x: 1, y: 2, z: 3 } }));
    document.revert(images);

    assert.deepEqual(document.tree.toJSON(), before);
  });

  test("undo of a move off an anchor puts the actor back on it", () => {
    const { document, history } = setup();
    const anchor = { component: "mesh", key: "object:spawn" };
    document.move("B", { parentId: "A", anchor }, { transform: SceneTransform.create() });

    history.record(kScope, null, () => document.move("B", { parentId: "A" }, {
      transform: SceneTransform.create()
    }));
    assert.ok(history.undo(kScope));

    assert.deepEqual(document.tree.actor("B")?.anchor, anchor);
  });

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
    history.record(kScope, null, () => document.changeComponent("light", new ComponentChange({
      data: { intensity: 3 }
    })));

    document.applyRemote({ action: "component-changed", id: "light", data: { color: "#ff0000" } }, "peer");

    assert.ok(history.undo(kScope));
    assert.deepEqual(document.tree.component("light")?.data, {
      intensity: 1,
      color: "#ff0000"
    });
  });

  test("undoes one override field while keeping a peer's override of another", () => {
    const { document, history } = setup();
    history.record(kScope, null, () => document.override(OverrideChange.actor({
      id: "P",
      path: "door",
      set: { visible: false }
    })));

    document.applyRemote({
      action: "actor-overridden",
      id: "P",
      path: "door",
      set: { name: "Peer door" }
    }, "peer");

    assert.ok(history.undo(kScope));
    assert.deepEqual(document.tree.actor("P")?.overrides?.actors?.door, { name: "Peer door" });
  });

  test("refuses to undo an override a peer rewrote", () => {
    const { document, history } = setup();
    history.record(kScope, null, () => document.override(OverrideChange.actor({
      id: "P",
      path: "window",
      set: { name: "Mine" }
    })));

    document.applyRemote({
      action: "actor-overridden",
      id: "P",
      path: "window",
      set: { name: "Theirs" }
    }, "peer");

    assert.equal(history.undo(kScope), false);
    assert.deepEqual(document.tree.actor("P")?.overrides?.actors?.window, { name: "Theirs" });
  });
});
