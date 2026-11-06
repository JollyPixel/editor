// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelTransform } from "../../../src/document/geometry/index.ts";
import { makeBlockDef } from "../../helpers/blocks.ts";
import {
  createCollision,
  makeChunk,
  makeCollider
} from "../../helpers/physicsCollider.ts";

describe("PhysicsVoxelCollider.rebuildChunk", () => {
  it("merges a filled merged cell into the cube run beside it", () => {
    const { collider, world } = makeCollider([
      makeBlockDef(1, "cube"),
      makeBlockDef(2, "slabBottom"),
      makeBlockDef(3, "slabTop")
    ]);
    const chunk = makeChunk([[0, 0, 0]]);
    chunk.set([1, 0, 0], {
      blockId: 2,
      transform: 0,
      partner: { blockId: 3, transform: 0 }
    });

    collider.rebuildChunk("a", createCollision(chunk));

    assert.deepEqual(
      world.colliderCalls.map(({ desc }) => [desc.hx, desc.translation]),
      [[1, { x: 1, y: 0.5, z: 0.5 }]]
    );
  });

  it("keeps a box per half when a merged cell does not fill its cell", () => {
    const { collider, world } = makeCollider([makeBlockDef(2, "slabBottom")]);
    const chunk = makeChunk([]);
    chunk.set([0, 0, 0], {
      blockId: 2,
      transform: 0,
      partner: { blockId: 2, transform: VoxelTransform.pack({ rotation: 1 }) }
    });

    collider.rebuildChunk("a", createCollision(chunk));

    assert.equal(world.colliderCalls.length, 2);
  });

  it("replaces the previous body instead of accumulating one per rebuild", () => {
    const { collider, world } = makeCollider([makeBlockDef(1, "cube")]);
    const chunk = makeChunk([[0, 0, 0]]);

    collider.rebuildChunk("a", createCollision(chunk));
    collider.rebuildChunk("a", createCollision(chunk));
    collider.rebuildChunk("a", createCollision(chunk));

    assert.equal(world.rigidBodies.length, 3);
    assert.equal(world.removedBodies.length, 2);
    assert.equal(world.liveBodies.length, 1);
  });
});
