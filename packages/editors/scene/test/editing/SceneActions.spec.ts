// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { SCENE_HISTORY_SCOPE } from "../../src/features/history/sceneHistory.ts";
import {
  actorNames,
  componentTypes,
  createActions
} from "../helpers/editing/sceneActions.ts";

function close(
  actual: number,
  expected: number
): void {
  assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} is not ${expected}`);
}

describe("SceneActions", () => {
  test("duplicates selected subtrees once each, after their source, as one step", () => {
    const { document, history, selection, actions } = createActions();
    const parentId = document.addActor({ name: "Parent" })!;
    const childId = document.addActor({ name: "Child", parentId })!;
    document.addActor({ name: "Last" });
    selection.select([childId, parentId]);

    const [copyId] = actions.duplicateSelection();

    assert.deepEqual(actorNames(document), ["Parent", "Child", "Parent (1)", "Child", "Last"]);
    assert.deepEqual(selection.ids, [copyId]);

    history.undo(SCENE_HISTORY_SCOPE);
    assert.deepEqual(actorNames(document), ["Parent", "Child", "Last"]);
  });

  test("deletes the selected roots as one step and drops them from the selection", () => {
    const { document, history, selection, actions } = createActions();
    const first = document.addActor({ name: "First" })!;
    const second = document.addActor({ name: "Second" })!;
    selection.select([first, second]);

    actions.removeSelection();

    assert.deepEqual(actorNames(document), []);
    assert.deepEqual(selection.ids, []);
    history.undo(SCENE_HISTORY_SCOPE);
    assert.deepEqual(actorNames(document), ["First", "Second"]);
  });

  test("moves an actor to a new parent keeping its world pose", () => {
    const { document, actions } = createActions();
    const parentId = document.addActor({
      name: "Parent",
      transform: {
        position: { x: 10, y: 0, z: 0 },
        rotation: { x: 0, y: 90, z: 0 }
      }
    })!;
    const childId = document.addActor({
      name: "Child",
      parentId,
      transform: { position: { x: 1, y: 0, z: 0 } }
    })!;

    actions.move([{ id: childId, parentId: null }]);

    const { parentId: movedParent, transform } = document.tree.actor(childId)!;
    assert.strictEqual(movedParent, null);
    close(transform.position.x, 10);
    close(transform.position.z, -1);
    close(transform.rotation.y, 90);
  });

  test("moves an actor onto an anchor keeping its world pose", () => {
    const spawn = { component: "map", key: "object:spawn" };
    const { document, actions } = createActions(null, {
      findAnchor: (actorId, anchor) => (actorId === mapId && anchor.key === spawn.key ?
        {
          key: spawn.key,
          label: "Spawn",
          kind: "object",
          pose: {
            position: { x: 4, y: 0, z: 0 },
            rotation: { x: 0, y: 90, z: 0 }
          }
        } :
        null)
    });
    const mapId = document.addActor({
      name: "Map",
      transform: { position: { x: 10, y: 0, z: 0 } }
    })!;
    const heroId = document.addActor({
      name: "Hero",
      transform: { position: { x: 14, y: 0, z: -2 } }
    })!;

    actions.move([{ id: heroId, parentId: mapId, anchor: spawn }]);

    const { parentId, anchor, transform } = document.tree.actor(heroId)!;
    assert.strictEqual(parentId, mapId);
    assert.deepEqual(anchor, spawn);
    close(transform.position.x, 2);
    close(transform.position.z, 0);
    close(transform.rotation.y, -90);
  });

  test("adds and selects an empty actor", () => {
    const { document, selection, actions } = createActions();

    const id = actions.addActor(null);

    const actor = document.tree.actor(id!)!;
    assert.deepEqual([actor.name, actor.components], ["Actor", []]);
    assert.deepEqual(selection.ids, [id]);
  });

  test("adds a component with its picked asset and none when the pick is cancelled", async() => {
    const map = { id: "map-1", kind: "voxelmap" };
    const picked = createActions(map);
    const cancelled = createActions(null);
    const pickedId = picked.document.addActor({ name: "Ground" })!;
    const cancelledId = cancelled.document.addActor({ name: "Ground" })!;

    await picked.actions.addComponent(pickedId, "VoxelMap");
    assert.strictEqual(await cancelled.actions.addComponent(cancelledId, "VoxelMap"), null);
    await cancelled.actions.addComponent(cancelledId, "Mesh");

    assert.deepEqual(picked.document.tree.actor(pickedId)!.components[0].assets, { map });
    assert.deepEqual(componentTypes(cancelled.document, cancelledId), ["Mesh"]);
    assert.deepEqual(cancelled.picks, ["voxelmap"]);
  });

  test("adds and selects an instance of the picked scene", async() => {
    const house = { id: "house", kind: "scene" };
    const { document, selection, actions } = createActions(house);

    const id = await actions.addInstance(null);

    const actor = document.tree.actor(id!)!;
    assert.strictEqual(actor.name, "Ground");
    assert.deepEqual(actor.prefab, house);
    assert.deepEqual(actor.components, []);
    assert.deepEqual(selection.ids, [id]);
  });
});
