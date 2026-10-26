// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";
import { SceneDocument } from "@jolly-pixel/asset.scene/client";

// Import Internal Dependencies
import { SceneActions } from "../../src/editing/SceneActions.ts";
import { ActorPreset } from "../../src/features/hierarchy/model/ActorPreset.ts";
import {
  createSceneHistory,
  SCENE_HISTORY_SCOPE
} from "../../src/features/history/sceneHistory.ts";
import { SelectionStore } from "../../src/state/SelectionStore.ts";

function createActions(
  picked: AssetReferenceData | null = null
) {
  const document = new SceneDocument();
  const history = createSceneHistory(document);
  const selection = new SelectionStore(document);
  const picks: string[] = [];
  const actions = new SceneActions({
    document,
    history,
    selection,
    assetSlots: {
      name: () => "Ground",
      pick: (type) => {
        picks.push(type.kind.value);

        return Promise.resolve(picked);
      }
    }
  });

  return { document, history, selection, actions, picks };
}

function preset(
  label: string,
  type: string
): ActorPreset {
  return new ActorPreset({
    id: label,
    label,
    components: [
      {
        type,
        data: {}
      }
    ]
  });
}

function names(
  document: SceneDocument
): string[] {
  return [...document.tree.actors()].map((actor) => actor.name);
}

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
    const childId = document.addActor({
      name: "Child",
      parentId,
      components: [{ id: "light", type: "Light", data: {}, assets: {} }]
    })!;
    document.addActor({ name: "Last" });
    selection.select([childId, parentId]);

    const [copyId] = actions.duplicateSelection();

    assert.deepEqual(names(document), ["Parent", "Child", "Parent (1)", "Child", "Last"]);
    assert.deepEqual(selection.ids, [copyId]);
    const copiedChild = [...document.tree.actors()][3];
    assert.notStrictEqual(copiedChild.id, childId);
    assert.strictEqual(copiedChild.parentId, copyId);
    assert.notStrictEqual(copiedChild.components[0].id, "light");

    history.undo(SCENE_HISTORY_SCOPE);
    assert.deepEqual(names(document), ["Parent", "Child", "Last"]);
  });

  test("deletes the selected roots as one step and drops them from the selection", () => {
    const { document, history, selection, actions } = createActions();
    const first = document.addActor({ name: "First" })!;
    const second = document.addActor({ name: "Second" })!;
    selection.select([first, second]);

    actions.removeSelection();

    assert.deepEqual(names(document), []);
    assert.deepEqual(selection.ids, []);
    history.undo(SCENE_HISTORY_SCOPE);
    assert.deepEqual(names(document), ["First", "Second"]);
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

  test("adds a voxel map actor named after the picked asset", async() => {
    const map = { id: "map-1", kind: "voxelmap" };
    const { document, selection, actions } = createActions(map);

    const id = await actions.addActor(preset("Voxel map", "VoxelMap"), null);

    const actor = document.tree.actor(id!)!;
    assert.strictEqual(actor.name, "Ground");
    assert.strictEqual(actor.components[0].type, "VoxelMap");
    assert.deepEqual(actor.components[0].assets, { map });
    assert.deepEqual(selection.ids, [id]);
  });

  test("adds nothing when the asset pick is cancelled, and never asks for a slot-free preset", async() => {
    const { document, actions, picks } = createActions(null);

    assert.strictEqual(await actions.addActor(preset("Voxel map", "VoxelMap"), null), null);
    assert.strictEqual(document.tree.size, 0);

    const boxId = await actions.addActor(preset("Box", "Mesh"), null);
    assert.strictEqual(document.tree.actor(boxId!)?.name, "Box");
    assert.deepEqual(picks, ["voxelmap"]);
  });

  test("numbers the copy of a copy after its source's count", () => {
    const { document, selection, actions } = createActions();
    selection.select([document.addActor({ name: "Box (1)" })!]);

    actions.duplicateSelection();

    assert.deepEqual(names(document), ["Box (1)", "Box (2)"]);
  });
});
