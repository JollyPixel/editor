// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { BlockDefinition } from "../../../src/document/blocks/index.ts";
import { Slab } from "../../../src/document/blocks/shape/library/Slab.ts";
import { makeBlockDef } from "../../helpers/blocks.ts";
import {
  type Cell,
  createCollision,
  makeChunk,
  makeCollider
} from "../../helpers/physicsCollider.ts";

describe("PhysicsVoxelCollider.rebuildChunk", () => {
  const kEmptyCases: [string, BlockDefinition[], Cell[][]][] = [
    ["no chunk", [makeBlockDef(1, "cube")], []],
    ["an empty chunk", [], [[]]],
    [
      "a chunk whose only block is not collidable",
      [makeBlockDef(1, "cube", { collidable: false })],
      [[[0, 0, 0]]]
    ],
    ["a chunk whose block is not registered", [], [[[0, 0, 0, 99]]]]
  ];

  it("refreshes cached bounds when a registered shape is replaced", () => {
    const { collider, world, shapeRegistry } = makeCollider([makeBlockDef(1, "cube")]);
    const chunk = makeChunk([[0, 0, 0]]);
    collider.rebuildChunk("a", createCollision(chunk));
    shapeRegistry.register(new Slab("bottom", "cube"));
    collider.rebuildChunk("a", createCollision(chunk));

    const { desc } = world.colliderCalls.at(-1)!;
    assert.equal(desc.hy, 0.25);
    assert.deepEqual(desc.translation, { x: 0.5, y: 0.25, z: 0.5 });
  });

  it("keeps trimesh winding outward for every rotation and mirror", () => {
    const { collider, world } = makeCollider([makeBlockDef(1, "ramp")]);
    for (let transform = 0; transform < 32; transform++) {
      collider.rebuildChunk("a", createCollision(makeChunk([[0, 0, 0, 1, transform]])));
      const { vertices, indices } = world.colliderCalls.at(-1)!.desc;
      assert.ok(vertices && indices);
      let volume = 0;
      for (let i = 0; i < indices.length; i += 3) {
        const a = new THREE.Vector3().fromArray(vertices, indices[i] * 3);
        const b = new THREE.Vector3().fromArray(vertices, indices[i + 1] * 3);
        const c = new THREE.Vector3().fromArray(vertices, indices[i + 2] * 3);
        volume += a.dot(b.cross(c)) / 6;
      }
      assert.ok(Math.abs(volume - 0.5) < 1e-10, `transform ${transform}`);
    }
  });

  it("never carries cells over from a previously built chunk", () => {
    const { collider, world } = makeCollider([makeBlockDef(1, "cube")]);

    collider.rebuildChunk("a", createCollision(makeChunk([[1, 0, 0]], 8)));
    collider.rebuildChunk("b", createCollision(makeChunk([[0, 0, 0]])));

    assert.equal(world.colliderCalls.length, 2);
    assert.equal(world.colliderCalls[1].desc.hx, 0.5);
  });

  for (const [name, blocks, chunks] of kEmptyCases) {
    it(`creates no body for ${name}`, () => {
      const { collider, world } = makeCollider(blocks);

      collider.rebuildChunk(
        "a",
        createCollision(chunks.map((cells) => makeChunk(cells)))
      );

      assert.equal(world.rigidBodies.length, 0);
    });
  }

  it("merges a run of cubes along X into one cuboid", () => {
    const { collider, world } = makeCollider([makeBlockDef(1, "cube")]);

    collider.rebuildChunk("a", createCollision(makeChunk([[0, 0, 0], [1, 0, 0], [3, 0, 0]])));

    assert.equal(world.rigidBodies.length, 1);
    assert.deepEqual(
      world.colliderCalls.map(({ desc }) => [desc.hx, desc.translation]),
      [
        [1, { x: 1, y: 0.5, z: 0.5 }],
        [0.5, { x: 3.5, y: 0.5, z: 0.5 }]
      ]
    );
    assert.ok(world.colliderCalls.every((call) => call.parent === world.rigidBodies[0]));
  });

  it("positions each cuboid at the voxel centre", () => {
    const { collider, world } = makeCollider([makeBlockDef(1, "cube")]);

    collider.rebuildChunk("a", createCollision(makeChunk([[2, 3, 1]])));

    const [{ desc }] = world.colliderCalls;
    assert.deepEqual(desc.translation, { x: 2.5, y: 3.5, z: 1.5 });
    assert.deepEqual([desc.hx, desc.hy, desc.hz], [0.5, 0.5, 0.5]);
  });

  it("places a fixed body at the collision origin", () => {
    const { collider, world } = makeCollider([makeBlockDef(1, "cube")]);

    collider.rebuildChunk(
      "a",
      createCollision(makeChunk([[0, 0, 0]], 4, [2, 0, 1]), { x: 16, y: 0, z: 4 })
    );

    assert.equal(world.rigidBodies.length, 1);
    assert.equal(world.rigidBodies[0].kind, "fixed");
    assert.deepEqual(world.rigidBodies[0].position, { x: 16, y: 0, z: 4 });
  });
});
