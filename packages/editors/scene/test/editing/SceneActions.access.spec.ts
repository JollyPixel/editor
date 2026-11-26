// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { SceneCapability } from "../../src/access/SceneAccess.ts";
import type { SceneActions } from "../../src/editing/SceneActions.ts";
import { SCENE_HISTORY_SCOPE } from "../../src/features/history/sceneHistory.ts";
import { createActions } from "../helpers/editing/sceneActions.ts";

interface ActionCase {
  capability: SceneCapability;
  edit: string;
  act: (actions: SceneActions) => unknown;
}

// CONSTANTS
const kCases: ActionCase[] = [
  {
    capability: "hierarchy",
    edit: "adding an actor",
    act: (actions) => actions.addActor(null)
  },
  {
    capability: "components",
    edit: "removing a component",
    act: (actions) => actions.removeComponent("lever")
  },
  {
    capability: "signals",
    edit: "connecting a signal",
    act: (actions) => actions.connect("lever", {
      signal: "pulled",
      target: "lever",
      method: "reset"
    })
  },
  {
    capability: "environment",
    edit: "linking an environment",
    act: (actions) => actions.changeEnvironment({
      id: "night",
      kind: "environment"
    })
  }
];

function createScene() {
  const scene = createActions();
  const actorId = scene.document.addActor({
    name: "Door",
    components: [{ id: "lever", type: "Lever", data: {}, assets: {} }]
  })!;
  const committed: string[] = [];
  scene.document.on("change", ({ command }) => committed.push(command.action));

  return {
    ...scene,
    actorId,
    committed
  };
}

describe("SceneActions with a capability withheld", () => {
  for (const { capability, edit, act } of kCases) {
    test(`refuses ${edit} without "${capability}" and allows it with only that capability`, () => {
      const { access, actions, committed } = createScene();

      access.withhold(capability);
      act(actions);
      assert.deepEqual(committed, []);

      access.grant(capability);
      act(actions);
      assert.strictEqual(committed.length, 1);
    });
  }

  test("does not open the asset picker to add a component without \"components\"", async() => {
    const { document, access, actions, picks } = createActions();
    const actorId = document.addActor({ name: "Ground" })!;
    access.withhold("components");

    assert.strictEqual(await actions.addComponent(actorId, "VoxelMap"), null);
    assert.deepEqual(picks, []);
  });

  test("refuses to delete the focused component without \"components\"", () => {
    const {
      access,
      actions,
      selection,
      actorId,
      committed
    } = createScene();
    selection.focus({ ownerId: actorId, componentId: "lever" });
    access.withhold("components");

    assert.strictEqual(actions.canEditSelection(), false);
    actions.removeSelection();

    assert.deepEqual(committed, []);
  });

  test("undoes and redoes nothing for a member who may only view the scene", () => {
    const {
      document,
      history,
      access,
      actions
    } = createActions();
    history.record(SCENE_HISTORY_SCOPE, "Add", () => document.addActor({ name: "Crate" }));

    access.viewOnly();
    assert.strictEqual(actions.undo(), false);
    assert.strictEqual([...document.tree.actors()].length, 1);

    access.grant("hierarchy");
    assert.strictEqual(actions.undo(), true);
    assert.strictEqual([...document.tree.actors()].length, 0);

    access.viewOnly();
    assert.strictEqual(actions.redo(), false);
    assert.strictEqual([...document.tree.actors()].length, 0);
  });
});
