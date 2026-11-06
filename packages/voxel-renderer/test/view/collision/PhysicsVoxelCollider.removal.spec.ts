// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { makeBlockDef } from "../../helpers/blocks.ts";
import {
  createCollision,
  makeChunk,
  makeCollider
} from "../../helpers/physicsCollider.ts";

describe("PhysicsVoxelCollider.removeChunk", () => {
  it("removes the chunk's body from the world", () => {
    const { collider, world } = makeCollider([makeBlockDef(1, "cube")]);

    collider.rebuildChunk("a", createCollision(makeChunk([[0, 0, 0]])));
    collider.removeChunk("a");

    assert.deepEqual(world.removedBodies, [world.rigidBodies[0]]);
    assert.equal(world.liveBodies.length, 0);
  });

  it("is a no-op for an unknown or already removed key", () => {
    const { collider, world } = makeCollider();

    collider.removeChunk("nope");
    collider.removeChunk("nope");

    assert.equal(world.removedBodies.length, 0);
  });
});

describe("PhysicsVoxelCollider.dispose", () => {
  it("removes every remaining chunk body and forgets them", () => {
    const { collider, world } = makeCollider([makeBlockDef(1, "cube")]);
    const chunk = makeChunk([[0, 0, 0]]);

    collider.rebuildChunk("a", createCollision(chunk));
    collider.rebuildChunk("b", createCollision(chunk));
    collider.dispose();

    assert.equal(world.liveBodies.length, 0);

    collider.removeChunk("a");
    assert.equal(world.removedBodies.length, 2);
  });
});
