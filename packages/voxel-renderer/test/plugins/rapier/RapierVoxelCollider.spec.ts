// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  type RapierAPI,
  type RapierCollider,
  type RapierColliderDesc,
  type RapierRigidBody,
  type RapierRigidBodyDesc,
  RapierVoxelCollider
} from "../../../src/plugins/rapier/index.ts";
import type { VoxelChunkCollision } from "../../../src/collision/index.ts";
import { VoxelChunk, VoxelTransform } from "../../../src/world/index.ts";
import { type BlockDefinition, BlockRegistry } from "../../../src/blocks/index.ts";
import { BlockShapeRegistry } from "../../../src/blocks/shape/index.ts";
import { Slab } from "../../../src/blocks/shape/library/Slab.ts";
import { makeBlockDef } from "../../helpers/blocks.ts";

// CONSTANTS
const kNoGeometries = new Map();

/**
 * What the mock world records: a cuboid desc carries half-extents, a trimesh
 * desc carries buffers, and only cuboids are translated (a trimesh bakes the
 * offset into its vertices).
 */
interface RecordedColliderDesc extends RapierColliderDesc {
  hx?: number;
  hy?: number;
  hz?: number;
  vertices?: Float32Array;
  indices?: Uint32Array;
  _translation?: { x: number; y: number; z: number; } | null;
}

function makeColliderDesc(hx: number, hy: number, hz: number): RapierColliderDesc & {
  hx: number;
  hy: number;
  hz: number;
  _translation: { x: number; y: number; z: number; } | null;
} {
  return {
    hx, hy, hz,
    _translation: null,
    setTranslation(x: number, y: number, z: number) {
      this._translation = { x, y, z };

      return this;
    }
  };
}

function makeRigidBodyDesc(): RapierRigidBodyDesc & {
  _translation: { x: number; y: number; z: number; } | null;
} {
  return {
    _translation: null,
    setTranslation(x: number, y: number, z: number) {
      this._translation = { x, y, z };

      return this;
    }
  };
}

function makeMockWorld() {
  const rigidBodies: RapierRigidBody[] = [];
  const colliderCalls: {
    desc: RecordedColliderDesc;
    parent: RapierRigidBody | undefined;
  }[] = [];
  const removedBodies: RapierRigidBody[] = [];

  return {
    rigidBodies,
    colliderCalls,
    removedBodies,

    /** Bodies still alive in the physics world. */
    get liveBodies() {
      return rigidBodies.filter((body) => !removedBodies.includes(body));
    },

    createRigidBody(_desc: RapierRigidBodyDesc): RapierRigidBody {
      const body = { handle: rigidBodies.length };
      rigidBodies.push(body);

      return body;
    },
    createCollider(desc: RecordedColliderDesc, parent?: RapierRigidBody): RapierCollider {
      const handle = colliderCalls.length;
      colliderCalls.push({ desc, parent });

      return { handle };
    },
    removeCollider(_collider: RapierCollider, _wakeUp: boolean): void {
      // no-op
    },
    removeRigidBody(body: RapierRigidBody): void {
      removedBodies.push(body);
    }
  };
}

function makeMockRapier() {
  const bodyDescs: ReturnType<typeof makeRigidBodyDesc>[] = [];

  return {
    bodyDescs,
    RigidBodyDesc: {
      fixed() {
        const desc = makeRigidBodyDesc();
        bodyDescs.push(desc);

        return desc;
      }
    },
    ColliderDesc: {
      cuboid(hx: number, hy: number, hz: number) {
        return makeColliderDesc(hx, hy, hz);
      },
      trimesh(vertices: Float32Array, indices: Uint32Array) {
        return {
          vertices,
          indices,
          setTranslation(_x: number, _y: number, _z: number): void {
            // no-op — trimesh translation is baked into vertex data instead.
          }
        };
      }
    }
  };
}

function makeCollider(
  blocks: BlockDefinition[] = []
) {
  const world = makeMockWorld();
  const rapier = makeMockRapier();
  const shapeRegistry = BlockShapeRegistry.createDefault();
  const collider = new RapierVoxelCollider({
    /*
     * trimesh()'s no-op setTranslation() returns void, not `this`, so the mock
     * does not structurally satisfy RapierColliderDesc — narrow instead of `any`.
     */
    api: rapier as unknown as RapierAPI,
    world,
    blockRegistry: new BlockRegistry(blocks),
    shapeRegistry
  });

  return { collider, world, rapier, shapeRegistry };
}

function collisionOf(
  chunk: VoxelChunk,
  geometries: VoxelChunkCollision["geometries"] = kNoGeometries,
  layerPosition = { x: 0, y: 0, z: 0 }
): VoxelChunkCollision {
  return { chunk, geometries, layerPosition };
}

/** Stand-in for a built chunk geometry (one triangle). */
function makeGeometry(vertexCount = 3) {
  const positions = new Float32Array(vertexCount * 3).map((_, i) => i);
  const indices = new Uint32Array(
    Array.from({ length: vertexCount }, (_, i) => i)
  );

  return {
    drawRange: { start: 0, count: Infinity },
    getAttribute(name: string) {
      return name === "position"
        ? { array: positions, count: vertexCount }
        : null;
    },
    getIndex() {
      return { array: indices, count: vertexCount };
    },
    dispose() {
      // no-op
    }
  } as unknown as THREE.BufferGeometry;
}

describe("RapierVoxelCollider.rebuildChunk", () => {
  it("refreshes cached bounds when a registered shape is replaced", () => {
    const { collider, world, shapeRegistry } = makeCollider([
      makeBlockDef(1, "cube")
    ]);
    const chunk = new VoxelChunk([0, 0, 0], 4);
    chunk.set([0, 0, 0], { blockId: 1, transform: 0 });
    collider.rebuildChunk("a", collisionOf(chunk));
    shapeRegistry.register(new Slab("bottom", "cube"));
    collider.rebuildChunk("a", collisionOf(chunk));

    const { desc } = world.colliderCalls.at(-1)!;
    assert.equal(desc.hy, 0.25);
    assert.deepEqual(desc._translation, { x: 0.5, y: 0.25, z: 0.5 });
  });

  it("keeps trimesh winding outward for every rotation and mirror", () => {
    const { collider, world } = makeCollider([makeBlockDef(1, "ramp")]);
    const chunk = new VoxelChunk([0, 0, 0], 4);
    for (let transform = 0; transform < 32; transform++) {
      chunk.set([0, 0, 0], { blockId: 1, transform });
      collider.rebuildChunk("a", collisionOf(chunk));
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

  it("does not allocate cube storage for a ramp-only chunk", (t) => {
    const { collider, world } = makeCollider([makeBlockDef(1, "ramp")]);
    const chunk = new VoxelChunk([0, 0, 0], 256);
    chunk.set([0, 0, 0], { blockId: 1, transform: 0 });
    const allocations = t.mock.method(globalThis, "Uint8Array");

    collider.rebuildChunk("a", collisionOf(chunk));

    assert.equal(allocations.mock.callCount(), 0);
    assert.equal(world.colliderCalls.length, 1);
  });

  it("reuses cube storage without retaining cells from previous chunks", (t) => {
    const { collider, world } = makeCollider([makeBlockDef(1, "cube")]);
    const first = new VoxelChunk([0, 0, 0], 8);
    first.set([1, 0, 0], { blockId: 1, transform: 0 });
    const second = new VoxelChunk([0, 0, 0], 4);
    second.set([0, 0, 0], { blockId: 1, transform: 0 });
    const allocations = t.mock.method(globalThis, "Uint8Array");

    collider.rebuildChunk("a", collisionOf(first));
    collider.rebuildChunk("b", collisionOf(second));

    assert.equal(allocations.mock.callCount(), 1);
    assert.equal(world.colliderCalls.length, 2);
    assert.equal(world.colliderCalls[1].desc.hx, 0.5);
  });

  it("creates no body for an empty chunk", () => {
    const { collider, world } = makeCollider();

    collider.rebuildChunk("a", collisionOf(new VoxelChunk([0, 0, 0], 4)));

    assert.equal(world.rigidBodies.length, 0);
  });

  it("clears scratch cells when creating a collider throws", (t) => {
    const { collider, world } = makeCollider([makeBlockDef(1, "cube")]);
    const first = new VoxelChunk([0, 0, 0], 4);
    first.set([0, 0, 0], { blockId: 1, transform: 0 });
    first.set([2, 0, 0], { blockId: 1, transform: 0 });
    const second = new VoxelChunk([0, 0, 0], 4);
    second.set([1, 0, 0], { blockId: 1, transform: 0 });
    const failure = new Error("Collider creation failed");
    const createCollider = t.mock.method(world, "createCollider", () => {
      throw failure;
    });

    assert.throws(() => collider.rebuildChunk("a", collisionOf(first)), failure);
    createCollider.mock.restore();
    collider.rebuildChunk("b", collisionOf(second));

    assert.equal(world.colliderCalls.length, 1);
    assert.equal(world.colliderCalls[0].desc.hx, 0.5);
  });

  it("creates no body when the only block is not collidable", () => {
    const chunk = new VoxelChunk([0, 0, 0], 4);
    chunk.set([0, 0, 0], { blockId: 1, transform: 0 });
    const { collider, world } = makeCollider([makeBlockDef(1, "cube", { collidable: false })]);

    collider.rebuildChunk("a", collisionOf(chunk));

    assert.equal(world.rigidBodies.length, 0);
  });

  it("creates no body when the blockId is not registered", () => {
    const chunk = new VoxelChunk([0, 0, 0], 4);
    chunk.set([0, 0, 0], { blockId: 99, transform: 0 });
    const { collider, world } = makeCollider();

    collider.rebuildChunk("a", collisionOf(chunk));

    assert.equal(world.rigidBodies.length, 0);
  });

  it("merges a run of cubes along X into one cuboid without voxels support", () => {
    const chunk = new VoxelChunk([0, 0, 0], 4);
    chunk.set([0, 0, 0], { blockId: 1, transform: 0 });
    chunk.set([1, 0, 0], { blockId: 1, transform: 0 });
    chunk.set([3, 0, 0], { blockId: 1, transform: 0 });
    const { collider, world } = makeCollider([makeBlockDef(1, "cube")]);

    collider.rebuildChunk("a", collisionOf(chunk));

    assert.equal(world.rigidBodies.length, 1);
    assert.deepEqual(
      world.colliderCalls.map(({ desc }) => [desc.hx, desc._translation]),
      [
        [1, { x: 1, y: 0.5, z: 0.5 }],
        [0.5, { x: 3.5, y: 0.5, z: 0.5 }]
      ]
    );
    assert.ok(
      world.colliderCalls.every((call) => call.parent === world.rigidBodies[0]),
      "every cuboid must be parented to the chunk body"
    );
  });

  it("positions each cuboid at the voxel centre", () => {
    const chunk = new VoxelChunk([0, 0, 0], 4);
    chunk.set([2, 3, 1], { blockId: 1, transform: 0 });
    const { collider, world } = makeCollider([makeBlockDef(1, "cube")]);

    collider.rebuildChunk("a", collisionOf(chunk));

    const [{ desc }] = world.colliderCalls;
    assert.deepEqual(desc._translation, { x: 2.5, y: 3.5, z: 1.5 });
    assert.deepEqual(
      { hx: desc.hx, hy: desc.hy, hz: desc.hz },
      { hx: 0.5, hy: 0.5, hz: 0.5 }
    );
  });

  it("places the body at the chunk origin plus the layer position", () => {
    // cx=2, cy=0, cz=1 at size 4, offset x=8 → (2*4+8, 0, 1*4)
    const chunk = new VoxelChunk([2, 0, 1], 4);
    chunk.set([0, 0, 0], { blockId: 1, transform: 0 });
    const { collider, rapier } = makeCollider([makeBlockDef(1, "cube")]);

    collider.rebuildChunk(
      "a",
      collisionOf(chunk, kNoGeometries, { x: 8, y: 0, z: 0 })
    );

    assert.equal(rapier.bodyDescs.length, 1);
    assert.deepEqual(rapier.bodyDescs[0]._translation, { x: 16, y: 0, z: 4 });
  });

  it("builds a single trimesh when a shape hints trimesh", () => {
    const chunk = new VoxelChunk([0, 0, 0], 4);
    chunk.set([0, 0, 0], { blockId: 1, transform: 0 });
    chunk.set([1, 0, 0], { blockId: 1, transform: 0 });
    const { collider, world } = makeCollider([makeBlockDef(1, "ramp")]);

    collider.rebuildChunk(
      "a",
      collisionOf(chunk, new Map([["atlas", makeGeometry()]]))
    );

    assert.equal(world.rigidBodies.length, 1);
    assert.equal(world.colliderCalls.length, 1, "one trimesh, not one per voxel");
    assert.ok(world.colliderCalls[0].desc.vertices instanceof Float32Array);
    assert.ok(world.colliderCalls[0].desc.indices instanceof Uint32Array);
  });

  it("builds the trimesh from shape faces without render geometry", () => {
    const chunk = new VoxelChunk([0, 0, 0], 4);
    chunk.set([1, 0, 0], { blockId: 1, transform: 0 });
    const { collider, world } = makeCollider([makeBlockDef(1, "ramp")]);

    collider.rebuildChunk("a", collisionOf(chunk));

    assert.equal(world.colliderCalls.length, 1);
    const { vertices, indices } = world.colliderCalls[0].desc;
    assert.ok(vertices && indices);
    assert.equal(Math.min(...vertices.filter((_, i) => i % 3 === 0)), 1);
    assert.equal(Math.max(...vertices.filter((_, i) => i % 3 === 0)), 2);
    assert.equal(Math.max(...indices), (vertices.length / 3) - 1);
  });

  it("keeps non-collidable and box blocks out of the trimesh", () => {
    const chunk = new VoxelChunk([0, 0, 0], 4);
    chunk.set([0, 0, 0], { blockId: 1, transform: 0 });
    chunk.set([1, 0, 0], { blockId: 2, transform: 0 });
    chunk.set([2, 0, 0], { blockId: 3, transform: 0 });
    const { collider, world } = makeCollider([
      makeBlockDef(1, "ramp"),
      makeBlockDef(2, "ramp", { collidable: false }),
      makeBlockDef(3, "cube")
    ]);

    collider.rebuildChunk("a", collisionOf(chunk));

    const trimesh = world.colliderCalls.find(({ desc }) => desc.vertices);
    const xs = trimesh!.desc.vertices!.filter((_, i) => i % 3 === 0);
    assert.equal(Math.max(...xs), 1);
    assert.equal(world.colliderCalls.length, 2);
  });

  it("merges a solid block of cubes into a single cuboid", () => {
    const chunk = new VoxelChunk([0, 0, 0], 4);
    for (let x = 0; x < 4; x++) {
      for (let y = 0; y < 2; y++) {
        for (let z = 0; z < 3; z++) {
          chunk.set([x, y, z], { blockId: 1, transform: 0 });
        }
      }
    }
    const { collider, world } = makeCollider([makeBlockDef(1, "cube")]);

    collider.rebuildChunk("a", collisionOf(chunk));

    assert.equal(world.colliderCalls.length, 1);
    const { desc } = world.colliderCalls[0];
    assert.deepEqual([desc.hx, desc.hy, desc.hz], [2, 1, 1.5]);
    assert.deepEqual(desc._translation, { x: 2, y: 1, z: 1.5 });
  });

  it("covers an L-shaped floor with cuboids of the same total volume", () => {
    const chunk = new VoxelChunk([0, 0, 0], 4);
    const cells = [[0, 0, 0], [1, 0, 0], [2, 0, 0], [0, 0, 1], [0, 0, 2]];
    for (const [x, y, z] of cells) {
      chunk.set([x, y, z], { blockId: 1, transform: 0 });
    }
    const { collider, world } = makeCollider([makeBlockDef(1, "cube")]);

    collider.rebuildChunk("a", collisionOf(chunk));

    const volume = world.colliderCalls.reduce(
      (total, { desc }) => total + (8 * desc.hx! * desc.hy! * desc.hz!),
      0
    );
    assert.equal(volume, cells.length);
    assert.equal(world.colliderCalls.length, 2);
  });

  it("sizes a slab cuboid to its half block, flipped by its transform", () => {
    const chunk = new VoxelChunk([0, 0, 0], 4);
    chunk.set([0, 0, 0], { blockId: 1, transform: 0 });
    chunk.set([1, 0, 0], {
      blockId: 1,
      transform: VoxelTransform.pack({ flipY: true })
    });
    const { collider, world } = makeCollider([makeBlockDef(1, "slabBottom")]);

    collider.rebuildChunk("a", collisionOf(chunk));

    const boxes = world.colliderCalls
      .map(({ desc }) => [desc.hy, desc._translation])
      .sort((a, b) => (a[1] as { x: number; }).x - (b[1] as { x: number; }).x);
    assert.deepEqual(boxes, [
      [0.25, { x: 0.5, y: 0.25, z: 0.5 }],
      [0.25, { x: 1.5, y: 0.75, z: 0.5 }]
    ]);
  });

  it("replaces the previous body instead of accumulating one per rebuild", () => {
    const chunk = new VoxelChunk([0, 0, 0], 4);
    chunk.set([0, 0, 0], { blockId: 1, transform: 0 });
    const { collider, world } = makeCollider([makeBlockDef(1, "cube")]);

    collider.rebuildChunk("a", collisionOf(chunk));
    collider.rebuildChunk("a", collisionOf(chunk));
    collider.rebuildChunk("a", collisionOf(chunk));

    assert.equal(world.rigidBodies.length, 3);
    assert.equal(world.removedBodies.length, 2, "earlier bodies must be removed");
    assert.equal(world.liveBodies.length, 1);
  });
});

describe("RapierVoxelCollider.removeChunk", () => {
  it("removes the chunk's rigid body from the world", () => {
    const chunk = new VoxelChunk([0, 0, 0], 4);
    chunk.set([0, 0, 0], { blockId: 1, transform: 0 });
    const { collider, world } = makeCollider([makeBlockDef(1, "cube")]);

    collider.rebuildChunk("a", collisionOf(chunk));
    collider.removeChunk("a");

    assert.deepEqual(world.removedBodies, [world.rigidBodies[0]]);
    assert.equal(world.liveBodies.length, 0);
  });

  it("is a no-op for an unknown or already removed key", () => {
    const { collider, world } = makeCollider();

    assert.doesNotThrow(() => {
      collider.removeChunk("nope");
      collider.removeChunk("nope");
    });
    assert.equal(world.removedBodies.length, 0);
  });
});

describe("RapierVoxelCollider.dispose", () => {
  it("removes every remaining chunk body", () => {
    const chunk = new VoxelChunk([0, 0, 0], 4);
    chunk.set([0, 0, 0], { blockId: 1, transform: 0 });
    const { collider, world } = makeCollider([makeBlockDef(1, "cube")]);

    collider.rebuildChunk("a", collisionOf(chunk));
    collider.rebuildChunk("b", collisionOf(chunk));
    collider.dispose();

    assert.equal(world.liveBodies.length, 0);

    // Bookkeeping is cleared, so a later removal cannot double-remove.
    collider.removeChunk("a");
    assert.equal(world.removedBodies.length, 2);
  });
});
