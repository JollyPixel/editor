// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import type { Actor } from "@jolly-pixel/engine";
import { VoxelWorld } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  ObjectAreaScene
} from "../../../../src/features/layers/objects/ObjectAreaScene.ts";
import {
  createObjectAt,
  objectKey
} from "../../../../src/features/layers/objects/objectArea.ts";
import {
  LayerVisibilityStore
} from "../../../../src/state/LayerVisibilityStore.ts";

function setup() {
  const world = new VoxelWorld(4);
  world.objectLayers.add("Triggers");
  const object = createObjectAt("Door", { x: 0, y: 0, z: 0 });
  world.objectLayers.addObject("Triggers", object);

  const visibility = new LayerVisibilityStore();
  const scene = new ObjectAreaScene({
    actor: {} as Actor,
    world,
    visibility
  });

  return {
    world,
    visibility,
    scene,
    key: objectKey("Triggers", object.id),
    rowId: `obj:Triggers/${object.id}`
  };
}

describe("ObjectAreaScene.shown", () => {
  test("shows an object when its layer and itself are visible", () => {
    const { scene, key } = setup();

    assert.strictEqual(scene.shown(key), true);
  });

  test("hides an object whose layer is hidden locally", () => {
    const { scene, visibility, key } = setup();
    visibility.override("object:Triggers", false);

    assert.strictEqual(scene.shown(key), false);
  });

  test("hides an object hidden locally", () => {
    const { scene, visibility, key, rowId } = setup();
    visibility.override(rowId, false);

    assert.strictEqual(scene.shown(key), false);
  });

  test("shows a saved hidden object shown locally", () => {
    const { world, scene, visibility, key, rowId } = setup();
    world.objectLayers.update("Triggers", { visible: false });
    visibility.override("object:Triggers", true);
    visibility.override(rowId, true);

    assert.strictEqual(scene.shown(key), true);
  });

  test("never shows an unknown object", () => {
    const { scene } = setup();

    assert.strictEqual(scene.shown(objectKey("Triggers", "missing")), false);
  });
});
