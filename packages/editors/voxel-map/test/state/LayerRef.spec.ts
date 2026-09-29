// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import { VoxelWorld } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  ObjectLayerRef,
  ObjectRef,
  parseLayerRef,
  VoxelLayerRef,
  type LayerRef
} from "../../src/state/index.ts";

function makeWorld(): VoxelWorld {
  const world = new VoxelWorld(4);
  world.addLayer("Ground");
  world.objectLayers.add("Triggers");
  world.objectLayers.addObject("Triggers", {
    id: "spawn",
    name: "Spawn",
    visible: true,
    x: 0,
    y: 0,
    z: 0
  });

  return world;
}

describe("LayerRef keys", () => {
  const refs: LayerRef[] = [
    new VoxelLayerRef("Ground"),
    new ObjectLayerRef("Triggers"),
    new ObjectRef("Triggers/Inside", "spawn")
  ];

  test("round-trips every kind", () => {
    for (const ref of refs) {
      assert.deepStrictEqual(parseLayerRef(ref.key), ref);
    }
  });

  test("keeps the three kinds apart when they share a name", () => {
    const keys = new Set([
      new VoxelLayerRef("same").key,
      new ObjectLayerRef("same").key,
      new ObjectRef("same", "same").key
    ]);

    assert.equal(keys.size, 3);
  });

  test("keys an object by its layer and id", () => {
    assert.equal(new ObjectRef("zone:north", "obj-1").key, "obj:zone:north/obj-1");
  });

  test("compares refs by key", () => {
    assert.equal(new VoxelLayerRef("a").equals(new VoxelLayerRef("a")), true);
    assert.equal(new VoxelLayerRef("a").equals(new ObjectLayerRef("a")), false);
    assert.equal(new VoxelLayerRef("a").equals(null), false);
  });
});

describe("LayerRef in a world", () => {
  test("tells which object layer it belongs to", () => {
    const object = new ObjectRef("Triggers", "spawn");

    assert.equal(new VoxelLayerRef("Ground").objectLayer, null);
    assert.equal(new ObjectLayerRef("Triggers").objectLayer, "Triggers");
    assert.equal(object.objectLayer, "Triggers");
    assert.deepStrictEqual(object.layer, new ObjectLayerRef("Triggers"));
    assert.equal(object.belongsTo("Triggers"), true);
    assert.equal(new VoxelLayerRef("Triggers").belongsTo("Triggers"), false);
  });

  test("checks that the entry still exists", () => {
    const world = makeWorld();

    assert.equal(new VoxelLayerRef("Ground").exists(world), true);
    assert.equal(new ObjectLayerRef("Triggers").exists(world), true);
    assert.equal(new ObjectRef("Triggers", "spawn").exists(world), true);
    assert.equal(new ObjectRef("Triggers", "gone").exists(world), false);
    assert.equal(new VoxelLayerRef("Gone").exists(world), false);
  });

  test("asks before removing a layer but not an object", () => {
    const world = makeWorld();

    assert.match(new VoxelLayerRef("Ground").removalMessage(world), /Ground/);
    assert.equal(
      new ObjectLayerRef("Triggers").removalMessage(world),
      "Delete the object layer \"Triggers\" and its 1 object(s)?"
    );
    assert.equal(new ObjectRef("Triggers", "spawn").removalMessage(world), null);
  });

  test("removes itself from the world", () => {
    const world = makeWorld();

    new ObjectRef("Triggers", "spawn").removeFrom(world);
    new VoxelLayerRef("Ground").removeFrom(world);

    assert.deepEqual(world.objectLayers.get("Triggers")?.objects, []);
    assert.deepEqual(world.getLayers(), []);
  });

  test("updates the object it points to", () => {
    const world = makeWorld();
    const ref = new ObjectRef("Triggers", "spawn");

    assert.equal(ref.update(world, { name: "Door" }), true);
    assert.equal(ref.objectIn(world)?.name, "Door");
  });
});
