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
import { InstanceOverrides } from "../../src/editing/InstanceOverrides.ts";
import {
  createSceneHistory,
  SCENE_HISTORY_SCOPE
} from "../../src/features/history/sceneHistory.ts";
import { createPrefabScenes } from "../helpers/prefabScenes.ts";
import { createProbeBinding } from "../helpers/probeComponents.ts";

function overriddenHouse() {
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
  const { scenes } = createPrefabScenes({ house, room });
  const { binding } = createProbeBinding(level, scenes);
  const history = createSceneHistory(level);
  const overrides = new InstanceOverrides({
    document: level,
    history,
    live: binding,
    prefabs: scenes
  });

  const writes = new ActorWrites(level);
  writes.rename(`${instanceId}/${doorId}`, "Front door");
  writes.changeComponent(`${instanceId}/knob`, new ComponentChange({ data: { label: "steel" } }));
  writes.rename(`${instanceId}/${roomId}/${lampId}`, "Hall lamp");

  return { level, house, room, doorId, roomId, lampId, instanceId, history, overrides };
}

describe("InstanceOverrides", () => {
  test("tells own actors, instances and expanded actors apart, a nested instance being expanded", () => {
    const { level, roomId, instanceId, overrides } = overriddenHouse();
    const ownId = level.addActor({ name: "Lamp post" })!;

    assert.strictEqual(overrides.role(ownId), "own");
    assert.strictEqual(overrides.role(instanceId), "instance");
    assert.strictEqual(overrides.role(`${instanceId}/${roomId}`), "inner");
    assert.strictEqual(overrides.exists(`${instanceId}/${roomId}`), true);
    assert.strictEqual(overrides.exists(`${instanceId}/gone`), false);
  });

  test("reverts an inner actor with its components as one step, and the whole instance as another", () => {
    const { level, doorId, roomId, lampId, instanceId, history, overrides } = overriddenHouse();
    const doorPath = `${instanceId}/${doorId}`;

    assert.strictEqual(overrides.componentOverridden(`${instanceId}/knob`), true);
    overrides.revertActor(doorPath);

    assert.strictEqual(overrides.actorOverridden(doorPath), false);
    assert.strictEqual(overrides.componentOverridden(`${instanceId}/knob`), false);
    assert.deepEqual(level.tree.actor(instanceId)?.overrides, {
      actors: { [`${roomId}/${lampId}`]: { name: "Hall lamp" } }
    });

    overrides.revertActor(instanceId);
    assert.strictEqual(level.tree.actor(instanceId)?.overrides, undefined);

    history.undo(SCENE_HISTORY_SCOPE);
    assert.strictEqual(overrides.actorOverridden(`${instanceId}/${roomId}/${lampId}`), true);
  });

  test("applies overrides to the prefab, nested ones as overrides there, and undo restores them here", () => {
    const { level, house, room, doorId, roomId, lampId, instanceId, history, overrides } = overriddenHouse();

    overrides.applyToPrefab(instanceId);

    assert.strictEqual(house.tree.actor(doorId)?.name, "Front door");
    assert.deepEqual(house.tree.component("knob")?.data, { label: "steel" });
    assert.deepEqual(house.tree.actor(roomId)?.overrides, {
      actors: { [lampId]: { name: "Hall lamp" } }
    });
    assert.strictEqual(room.tree.actor(lampId)?.name, "Lamp");
    assert.strictEqual(level.tree.actor(instanceId)?.overrides, undefined);

    history.undo(SCENE_HISTORY_SCOPE);
    assert.strictEqual(overrides.actorOverridden(instanceId), true);
    assert.strictEqual(house.tree.actor(doorId)?.name, "Front door");
  });
});
