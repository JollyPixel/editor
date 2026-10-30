// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  AssetType,
  type AssetReferenceData
} from "@jolly-pixel/asset";
import { SceneDocument } from "@jolly-pixel/asset.scene/client";
import type { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import { SceneActions } from "../../src/editing/SceneActions.ts";
import { ActorPreset } from "../../src/features/hierarchy/model/ActorPreset.ts";
import {
  createSceneHistory,
  SCENE_HISTORY_SCOPE
} from "../../src/features/history/sceneHistory.ts";
import { SelectionStore } from "../../src/state/SelectionStore.ts";
import { NO_EXPANDED_ACTORS } from "../helpers/expandedActors.ts";
import { createSceneComponents } from "../helpers/sceneComponents.ts";

// CONSTANTS
const kComponents = createSceneComponents([
  "maps",
  {
    components: [
      {
        definition: {
          type: "VoxelMap",
          assets: {
            map: new AssetType<unknown>("voxelmap")
          },
          parse() {
            return {};
          },
          create() {
            return null;
          }
        },
        label: "Voxel map",
        icon: "actor-voxel-map",
        form: () => []
      }
    ]
  }
]);

function createActions(
  picked: AssetReferenceData | null = null,
  anchors: Pick<Systems.SceneAnchorsReader, "findAnchor"> = { findAnchor: () => null }
) {
  const document = new SceneDocument();
  const history = createSceneHistory(document);
  const selection = new SelectionStore(document, NO_EXPANDED_ACTORS);
  const picks: string[] = [];
  const actions = new SceneActions({
    document,
    history,
    selection,
    components: kComponents,
    assetSlots: {
      name: () => "Ground",
      pick: (type) => {
        picks.push(type.kind.value);

        return Promise.resolve(picked);
      },
      pickScene: () => {
        picks.push("scene");

        return Promise.resolve(picked);
      }
    },
    anchors
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
  }, kComponents);
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
    const childId = document.addActor({ name: "Child", parentId })!;
    document.addActor({ name: "Last" });
    selection.select([childId, parentId]);

    const [copyId] = actions.duplicateSelection();

    assert.deepEqual(names(document), ["Parent", "Child", "Parent (1)", "Child", "Last"]);
    assert.deepEqual(selection.ids, [copyId]);

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
