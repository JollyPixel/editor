// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelWorld } from "../../../src/document/world/index.ts";
import { makeObject, recordCommands } from "../../helpers/fakes.ts";

function makeWorld(): VoxelWorld {
  const world = new VoxelWorld(4);
  world.objectLayers.add("From");
  world.objectLayers.add("To");
  world.objectLayers.addObject("From", makeObject());

  return world;
}

describe("VoxelWorld - object edits", () => {
  it("moves the object itself rather than a copy", () => {
    const world = makeWorld();
    const before = world.objectLayers.get("From")!.objects[0];

    assert.equal(world.objectLayers.moveObject("From", "obj1", "To"), true);

    assert.deepEqual(world.objectLayers.get("From")?.objects, []);
    assert.equal(world.objectLayers.get("To")?.objects[0], before);
  });

  it("moves nothing when a layer or the object is unknown", () => {
    const world = makeWorld();
    const commands = recordCommands(world);

    assert.equal(world.objectLayers.moveObject("NoSuch", "obj1", "To"), false);
    assert.equal(world.objectLayers.moveObject("From", "obj1", "NoSuch"), false);
    assert.equal(world.objectLayers.moveObject("From", "nope", "To"), false);
    assert.equal(world.objectLayers.moveObject("From", "obj1", "From"), false);

    assert.equal(world.objectLayers.get("From")?.objects.length, 1);
    assert.deepEqual(commands, []);
  });

  it("updates nothing when the layer or the object is unknown", () => {
    const world = makeWorld();
    const commands = recordCommands(world);

    assert.equal(world.objectLayers.updateObject("NoSuch", "obj1", { x: 5 }), false);
    assert.equal(world.objectLayers.updateObject("From", "nope", { x: 5 }), false);

    assert.equal(world.objectLayers.get("From")?.objects[0].x, 0);
    assert.deepEqual(commands, []);
  });
});

describe("VoxelWorld - object layers", () => {
  it("never hands out an id that a restored object layer already holds", () => {
    const world = new VoxelWorld(4);
    world.objectLayers.add("Loaded").id = "obj_layer_1";

    world.objectLayers.add("Spawns");
    world.objectLayers.add("Triggers");

    const ids = world.objectLayers.toArray().map((layer) => layer.id);
    assert.equal(new Set(ids).size, 3);
  });

  it("restores layers without a command, copying their object lists", () => {
    const world = new VoxelWorld(4);
    const commands = recordCommands(world);
    const objects = [makeObject()];

    world.objectLayers.restore([
      {
        id: "obj_layer_7",
        name: "Spawns",
        visible: false,
        order: 3,
        objects
      }
    ]);

    const restored = world.objectLayers.get("Spawns");
    assert.equal(restored?.id, "obj_layer_7");
    assert.equal(restored?.visible, false);
    assert.notEqual(restored?.objects, objects);
    assert.deepEqual(restored?.objects, objects);
    assert.deepEqual(commands, []);
  });

  it("applies a command without dispatching it", () => {
    const world = makeWorld();
    const commands = recordCommands(world);

    const applied = world.objectLayers.apply({
      action: "object-removed",
      layerName: "From",
      metadata: { objectId: "obj1" }
    });

    assert.equal(applied?.action, "object-removed");
    assert.deepEqual(world.objectLayers.get("From")?.objects, []);
    assert.deepEqual(commands, []);
  });

  it("empties with the world", () => {
    const world = makeWorld();

    world.clear();

    assert.equal(world.objectLayers.size, 0);
  });
});
