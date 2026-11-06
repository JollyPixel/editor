// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { SceneDocument } from "@jolly-pixel/asset.scene/client";

// Import Internal Dependencies
import { SCENE_HISTORY_SCOPE } from "../../src/features/history/sceneHistory.ts";
import {
  actorNames,
  componentTypes,
  createActions
} from "../helpers/editing/sceneActions.ts";
import { createPrefabScenes } from "../helpers/prefabScenes.ts";

describe("SceneActions on a focused component", () => {
  test("edits a focused component of its own but not one of an expanded instance", () => {
    const house = new SceneDocument();
    const doorId = house.addActor({
      name: "Door",
      components: [{ id: "knob", type: "Patched", data: {}, assets: {} }]
    })!;
    const { document, selection, actions, live } = createActions(
      null,
      undefined,
      createPrefabScenes({ house }).scenes
    );
    const instanceId = document.addActor({ name: "House", prefab: { id: "house", kind: "scene" } })!;
    const rigId = document.addActor({
      name: "Rig",
      components: [{ id: "light", type: "Light", data: {}, assets: {} }]
    })!;
    const knobId = `${instanceId}/knob`;
    assert.notStrictEqual(live.componentEntry(knobId), null);

    selection.focus({ ownerId: rigId, componentId: "light" });
    assert.strictEqual(actions.canEditSelection(), true);

    selection.focus({ ownerId: `${instanceId}/${doorId}`, componentId: knobId });
    assert.strictEqual(actions.canEditSelection(), false);
  });

  test("adds a component with its kind's initial data and focuses it", async() => {
    const { document, selection, actions } = createActions();
    const actorId = document.addActor({ name: "Rig" })!;

    const id = await actions.addComponent(actorId, "Mesh");

    assert.deepEqual(
      document.tree.actor(actorId)!.components.map(({ type, data }) => [type, data]),
      [["Mesh", { castShadow: true, receiveShadow: true }]]
    );
    assert.deepEqual(
      [selection.ids, selection.focused],
      [[actorId], { ownerId: actorId, componentId: id }]
    );
  });

  test("duplicates the focused component right after it, leaving the actors alone", () => {
    const { document, selection, actions } = createActions();
    const actorId = document.addActor({
      name: "Rig",
      components: [
        { id: "light", type: "Light", data: { intensity: 2 }, assets: {} },
        { id: "mesh", type: "Mesh", data: {}, assets: {} }
      ]
    })!;
    selection.focus({ ownerId: actorId, componentId: "light" });

    const [copyId] = actions.duplicateSelection();

    assert.deepEqual(actorNames(document), ["Rig"]);
    const components = document.tree.actor(actorId)!.components;
    assert.deepEqual(components.map(({ id }) => id), ["light", copyId, "mesh"]);
    assert.deepEqual(components[1].data, { intensity: 2 });
    assert.deepEqual(selection.focused, { ownerId: actorId, componentId: copyId });
  });

  test("removes the focused component and leaves its actor selected", () => {
    const { document, history, selection, actions } = createActions();
    const actorId = document.addActor({
      name: "Rig",
      components: [{ id: "light", type: "Light", data: {}, assets: {} }]
    })!;
    selection.focus({ ownerId: actorId, componentId: "light" });

    actions.removeSelection();

    assert.deepEqual(actorNames(document), ["Rig"]);
    assert.deepEqual(componentTypes(document, actorId), []);
    assert.deepEqual([selection.ids, selection.focused], [[actorId], null]);
    history.undo(SCENE_HISTORY_SCOPE);
    assert.deepEqual(componentTypes(document, actorId), ["Light"]);
  });
});
