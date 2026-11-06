// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelTransform } from "../../../src/document/geometry/index.ts";
import { makeBlockDef } from "../../helpers/blocks.ts";
import {
  type Cell,
  createCollision,
  makeChunk,
  makeCollider
} from "../../helpers/physicsCollider.ts";

function readXs(
  vertices: Float32Array
): number[] {
  return [...vertices.filter((_, i) => i % 3 === 0)];
}

describe("PhysicsVoxelCollider.rebuildChunk", () => {
  it("builds one body from the solids of every layer chunk", () => {
    const { collider, world } = makeCollider([makeBlockDef(1, "cube")]);

    collider.rebuildChunk("a", createCollision([
      makeChunk([[0, 0, 0], [1, 0, 0]]),
      makeChunk([[1, 0, 0], [2, 0, 0]])
    ]));

    assert.equal(world.rigidBodies.length, 1);
    assert.deepEqual(
      world.colliderCalls.map(({ desc }) => [desc.hx, desc.translation]),
      [[1.5, { x: 1.5, y: 0.5, z: 0.5 }]]
    );
  });

  it("merges adjacent trimesh blocks into one body with one trimesh", () => {
    const { collider, world } = makeCollider([makeBlockDef(1, "ramp")]);

    collider.rebuildChunk("a", createCollision(makeChunk([[0, 0, 0], [1, 0, 0]])));

    assert.equal(world.rigidBodies.length, 1);
    assert.equal(world.colliderCalls.length, 1);
    const { vertices } = world.colliderCalls[0].desc;
    assert.ok(vertices);
    assert.equal(Math.min(...readXs(vertices)), 0);
    assert.equal(Math.max(...readXs(vertices)), 2);
  });

  it("builds the trimesh from shape faces without render geometry", () => {
    const { collider, world } = makeCollider([makeBlockDef(1, "ramp")]);

    collider.rebuildChunk("a", createCollision(makeChunk([[1, 0, 0]])));

    assert.equal(world.colliderCalls.length, 1);
    const { vertices, indices } = world.colliderCalls[0].desc;
    assert.ok(vertices && indices);
    assert.equal(Math.min(...readXs(vertices)), 1);
    assert.equal(Math.max(...readXs(vertices)), 2);
    assert.equal(Math.max(...indices), (vertices.length / 3) - 1);
  });

  it("keeps non-collidable and box blocks out of the trimesh", () => {
    const { collider, world } = makeCollider([
      makeBlockDef(1, "ramp"),
      makeBlockDef(2, "ramp", { collidable: false }),
      makeBlockDef(3, "cube")
    ]);

    collider.rebuildChunk("a", createCollision(makeChunk([[0, 0, 0, 1], [1, 0, 0, 2], [2, 0, 0, 3]])));

    const trimesh = world.colliderCalls.find(({ desc }) => desc.vertices);
    assert.equal(Math.max(...readXs(trimesh!.desc.vertices!)), 1);
    assert.equal(world.colliderCalls.length, 2);
  });

  it("merges a solid block of cubes into a single cuboid", () => {
    const cells: Cell[] = [];
    for (let x = 0; x < 4; x++) {
      for (let y = 0; y < 2; y++) {
        for (let z = 0; z < 3; z++) {
          cells.push([x, y, z]);
        }
      }
    }
    const { collider, world } = makeCollider([makeBlockDef(1, "cube")]);

    collider.rebuildChunk("a", createCollision(makeChunk(cells)));

    assert.equal(world.colliderCalls.length, 1);
    const { desc } = world.colliderCalls[0];
    assert.deepEqual([desc.hx, desc.hy, desc.hz], [2, 1, 1.5]);
    assert.deepEqual(desc.translation, { x: 2, y: 1, z: 1.5 });
  });

  it("covers an L-shaped floor with cuboids of the same total volume", () => {
    const cells: Cell[] = [[0, 0, 0], [1, 0, 0], [2, 0, 0], [0, 0, 1], [0, 0, 2]];
    const { collider, world } = makeCollider([makeBlockDef(1, "cube")]);

    collider.rebuildChunk("a", createCollision(makeChunk(cells)));

    const volume = world.colliderCalls.reduce(
      (total, { desc }) => total + (8 * desc.hx! * desc.hy! * desc.hz!),
      0
    );
    assert.equal(volume, cells.length);
    assert.equal(world.colliderCalls.length, 2);
  });

  it("sizes a slab cuboid to its half block, flipped by its transform", () => {
    const { collider, world } = makeCollider([makeBlockDef(1, "slabBottom")]);
    const flipped = VoxelTransform.pack({ flipY: true });

    collider.rebuildChunk("a", createCollision(makeChunk([[0, 0, 0], [1, 0, 0, 1, flipped]])));

    const boxes = world.colliderCalls
      .map(({ desc }) => [desc.hy, desc.translation] as const)
      .sort((a, b) => a[1]!.x - b[1]!.x);
    assert.deepEqual(boxes, [
      [0.25, { x: 0.5, y: 0.25, z: 0.5 }],
      [0.25, { x: 1.5, y: 0.75, z: 0.5 }]
    ]);
  });
});
