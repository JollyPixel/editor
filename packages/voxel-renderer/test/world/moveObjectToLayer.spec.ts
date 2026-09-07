// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelWorld } from "../../src/world/index.ts";
import type { VoxelLayerHookEvent } from "../../src/hooks.ts";
import type { VoxelObjectJSON } from "../../src/serialization/index.ts";

function makeObject(
  overrides: Partial<VoxelObjectJSON> = {}
): VoxelObjectJSON {
  return {
    id: "obj1",
    name: "Spawn",
    x: 0,
    y: 0,
    z: 0,
    visible: true,
    ...overrides
  };
}

function makeWorld() {
  const world = new VoxelWorld(4);
  world.addObjectLayer("From");
  world.addObjectLayer("To");
  world.addObjectToLayer("From", makeObject());

  return world;
}

describe("VoxelWorld — moveObjectToLayer", () => {
  it("moves the object across in one step", () => {
    const world = makeWorld();

    assert.equal(world.moveObjectToLayer("From", "obj1", "To"), true);

    assert.deepEqual(world.getObjectLayer("From")?.objects, []);
    assert.deepEqual(
      world.getObjectLayer("To")?.objects.map((object) => object.id),
      ["obj1"]
    );
  });

  it("keeps the object identity rather than copying it", () => {
    const world = makeWorld();
    const before = world.getObjectLayer("From")!.objects[0];

    world.moveObjectToLayer("From", "obj1", "To");

    assert.equal(world.getObjectLayer("To")?.objects[0], before);
  });

  it("emits one event naming both sides", () => {
    const world = makeWorld();
    const events: VoxelLayerHookEvent[] = [];
    world.onLayerUpdated = (event) => events.push(event);

    world.moveObjectToLayer("From", "obj1", "To");

    assert.equal(events.length, 1);
    assert.deepEqual(events[0], {
      action: "object-moved",
      layerName: "From",
      metadata: {
        objectId: "obj1",
        fromLayerName: "From",
        toLayerName: "To"
      }
    });
  });

  it("moves nothing when a layer or the object is unknown", () => {
    const world = makeWorld();
    const events: VoxelLayerHookEvent[] = [];
    world.onLayerUpdated = (event) => events.push(event);

    assert.equal(world.moveObjectToLayer("NoSuch", "obj1", "To"), false);
    assert.equal(world.moveObjectToLayer("From", "obj1", "NoSuch"), false);
    assert.equal(world.moveObjectToLayer("From", "nope", "To"), false);
    assert.equal(world.moveObjectToLayer("From", "obj1", "From"), false);

    assert.equal(world.getObjectLayer("From")?.objects.length, 1);
    assert.deepEqual(events, []);
  });
});
