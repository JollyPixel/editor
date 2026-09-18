// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelWorld } from "../../src/world/index.ts";
import { makeObject, recordCommands } from "../helpers/fakes.ts";

function makeWorld(): VoxelWorld {
  const world = new VoxelWorld(4);
  world.addObjectLayer("From");
  world.addObjectLayer("To");
  world.addObjectToLayer("From", makeObject());

  return world;
}

describe("VoxelWorld - object edits", () => {
  it("moves the object itself rather than a copy", () => {
    const world = makeWorld();
    const before = world.getObjectLayer("From")!.objects[0];

    assert.equal(world.moveObjectToLayer("From", "obj1", "To"), true);

    assert.deepEqual(world.getObjectLayer("From")?.objects, []);
    assert.equal(world.getObjectLayer("To")?.objects[0], before);
  });

  it("moves nothing when a layer or the object is unknown", () => {
    const world = makeWorld();
    const commands = recordCommands(world);

    assert.equal(world.moveObjectToLayer("NoSuch", "obj1", "To"), false);
    assert.equal(world.moveObjectToLayer("From", "obj1", "NoSuch"), false);
    assert.equal(world.moveObjectToLayer("From", "nope", "To"), false);
    assert.equal(world.moveObjectToLayer("From", "obj1", "From"), false);

    assert.equal(world.getObjectLayer("From")?.objects.length, 1);
    assert.deepEqual(commands, []);
  });

  it("updates nothing when the layer or the object is unknown", () => {
    const world = makeWorld();
    const commands = recordCommands(world);

    assert.equal(world.updateObjectInLayer("NoSuch", "obj1", { x: 5 }), false);
    assert.equal(world.updateObjectInLayer("From", "nope", { x: 5 }), false);

    assert.equal(world.getObjectLayer("From")?.objects[0].x, 0);
    assert.deepEqual(commands, []);
  });
});
