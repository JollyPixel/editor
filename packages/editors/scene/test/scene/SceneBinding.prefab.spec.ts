// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  ComponentChange,
  SceneDocument
} from "@jolly-pixel/asset.scene/client";

// Import Internal Dependencies
import { ActorWrites } from "../../src/editing/ActorWrites.ts";
import { SelectionStore } from "../../src/state/SelectionStore.ts";
import { createSceneHistory, SCENE_HISTORY_SCOPE } from "../../src/features/history/sceneHistory.ts";
import { createPrefabScenes } from "../helpers/prefabScenes.ts";
import {
  createProbeBinding,
  type Probe
} from "../helpers/probeComponents.ts";

function houseLevel() {
  const room = new SceneDocument();
  const lampId = room.addActor({ name: "Lamp" })!;
  const house = new SceneDocument();
  const doorId = house.addActor({
    name: "Door",
    components: [{ id: "knob", type: "Patched", data: { label: "brass" }, assets: {} }]
  })!;
  const roomId = house.addActor({ name: "Room", prefab: { id: "room", kind: "scene" } })!;
  const level = new SceneDocument();
  const instanceId = level.addActor({ name: "House", prefab: { id: "house", kind: "scene" } })!;
  const prefabs = createPrefabScenes({ house, room });
  const { binding } = createProbeBinding(level, prefabs.scenes);

  return { level, house, doorId, roomId, lampId, instanceId, binding, ...prefabs };
}

describe("SceneBinding prefab instances", () => {
  test("expands an instance from its scene and follows that scene's changes", () => {
    const house = new SceneDocument();
    const doorId = house.addActor({ name: "Door" })!;
    const level = new SceneDocument();
    const instanceId = level.addActor({ name: "House", prefab: { id: "house", kind: "scene" } })!;
    const { scenes } = createPrefabScenes({ house });
    const { binding } = createProbeBinding(level, scenes);
    const door = binding.actor(`${instanceId}/${doorId}`)!;
    assert.strictEqual(door.parent, binding.actor(instanceId));

    const windowId = house.addActor({
      name: "Window",
      components: [{ id: "probe", type: "Patched", data: {}, assets: {} }]
    })!;

    assert.strictEqual(door.pendingForDestruction, true);
    assert.strictEqual(binding.actor(`${instanceId}/${windowId}`)!.parent, binding.actor(instanceId));
    assert.ok(binding.component(`${instanceId}/probe`) !== null);
  });

  test("picks an actor inside an instance as the instance", () => {
    const house = new SceneDocument();
    const doorId = house.addActor({ name: "Door" })!;
    const level = new SceneDocument();
    const instanceId = level.addActor({ name: "House", prefab: { id: "house", kind: "scene" } })!;
    const { scenes } = createPrefabScenes({ house });
    const { binding } = createProbeBinding(level, scenes);

    const door = binding.actor(`${instanceId}/${doorId}`)!;

    assert.strictEqual(binding.findActorId(door.object3D), instanceId);
  });

  test("releases a scene and the scenes it includes once no instance references them", async() => {
    const { level, instanceId, released } = houseLevel();
    const otherId = level.addActor({ name: "Other house", prefab: { id: "house", kind: "scene" } })!;

    level.remove(otherId);
    await Promise.resolve();
    assert.deepEqual(released, []);

    level.remove(instanceId);
    await Promise.resolve();
    assert.deepEqual(released.toSorted(), ["house", "room"]);
  });

  test("keeps a scene leased when its instance is removed and added back in one step", async() => {
    const { level, instanceId, released } = houseLevel();
    const history = createSceneHistory(level);

    history.record(SCENE_HISTORY_SCOPE, null, () => level.remove(instanceId));
    history.undo(SCENE_HISTORY_SCOPE);
    await Promise.resolve();

    assert.deepEqual(released, []);
  });

  test("shows overrides on the live inner actors without rebuilding them, and drops them on undo", () => {
    const { level, doorId, roomId, lampId, instanceId, binding } = houseLevel();
    const writes = new ActorWrites(level);
    const history = createSceneHistory(level);
    const doorPath = `${instanceId}/${doorId}`;
    const door = binding.actor(doorPath)!;

    history.record(SCENE_HISTORY_SCOPE, null, () => {
      writes.rename(doorPath, "Front door");
      writes.transform(doorPath, { position: { x: 3, y: 0, z: 0 } });
      writes.changeComponent(`${instanceId}/knob`, new ComponentChange({ data: { label: "steel" } }));
      writes.rename(`${instanceId}/${roomId}/${lampId}`, "Hall lamp");
    });

    assert.strictEqual(binding.actor(doorPath), door);
    assert.strictEqual(door.name, "Front door");
    assert.strictEqual(door.object3D.position.x, 3);
    assert.strictEqual((binding.component(`${instanceId}/knob`) as Probe).label, "steel");
    assert.strictEqual(binding.expandedActor(doorPath)?.name, "Front door");
    assert.deepEqual(
      [...binding.expandedActors(`${instanceId}/${roomId}`)].map(({ name }) => name),
      ["Hall lamp"]
    );

    history.undo(SCENE_HISTORY_SCOPE);

    assert.strictEqual(door.name, "Door");
    assert.strictEqual(door.object3D.position.x, 0);
    assert.strictEqual((binding.component(`${instanceId}/knob`) as Probe).label, "brass");
  });

  test("routes writes on a document actor to the actor and on an inner actor to its instance", () => {
    const { level, doorId, instanceId } = houseLevel();
    const writes = new ActorWrites(level);
    const commands: unknown[] = [];
    level.on("change", ({ command }) => commands.push(command));

    writes.rename(instanceId, "Mansion");
    writes.changeVisibility(`${instanceId}/${doorId}`, false);
    writes.changeComponent(`${instanceId}/knob`, new ComponentChange({ unset: ["label"] }));
    writes.changeComponentAssets(`${instanceId}/knob`, { map: null });

    assert.deepEqual(commands, [
      { action: "actor-renamed", id: instanceId, name: "Mansion" },
      { action: "actor-overridden", id: instanceId, path: doorId, set: { visible: false } },
      { action: "component-overridden", id: instanceId, path: "knob", unset: { data: ["label"] } },
      { action: "component-overridden", id: instanceId, path: "knob", set: { assets: { map: null } } }
    ]);
  });

  test("drops an inner actor from the selection once its prefab no longer has it", () => {
    const { level, house, doorId, instanceId, binding } = houseLevel();
    const selection = new SelectionStore(level, binding);
    selection.select([instanceId, `${instanceId}/${doorId}`]);

    house.remove(doorId);

    assert.deepEqual(selection.ids, [instanceId]);
  });

  test("finds nothing for a missing scene and releases what it leased on dispose", () => {
    const { scenes, released } = createPrefabScenes({ house: new SceneDocument() });

    assert.strictEqual(scenes.find("gone"), null);
    assert.deepEqual(scenes.find("house"), { actors: [] });

    scenes.dispose();
    assert.deepEqual(released, ["house"]);
  });
});
