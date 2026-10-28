// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { SceneDocument } from "@jolly-pixel/asset.scene/client";

// Import Internal Dependencies
import { createPrefabScenes } from "../helpers/prefabScenes.ts";
import { createProbeBinding } from "../helpers/probeComponents.ts";

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

  test("finds nothing for a missing scene and releases what it leased on dispose", () => {
    const { scenes, released } = createPrefabScenes({ house: new SceneDocument() });

    assert.strictEqual(scenes.find("gone"), null);
    assert.deepEqual(scenes.find("house"), { actors: [] });

    scenes.dispose();
    assert.deepEqual(released, ["house"]);
  });
});
