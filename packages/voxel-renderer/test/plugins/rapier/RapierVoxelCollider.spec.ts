// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as THREE from "three";

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
import { VoxelChunk } from "../../../src/world/index.ts";
import { type BlockDefinition, BlockRegistry } from "../../../src/blocks/index.ts";
import { BlockShapeRegistry } from "../../../src/blocks/shape/index.ts";
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
  const collider = new RapierVoxelCollider({
    // trimesh()'s no-op setTranslation() returns void, not `this`, so the mock
    // does not structurally satisfy RapierColliderDesc — narrow instead of `any`.
    api: rapier as unknown as RapierAPI,
    world,
    blockRegistry: new BlockRegistry(blocks),
    shapeRegistry: BlockShapeRegistry.createDefault()
  });

  return { collider, world, rapier };
}

function collisionOf(
  chunk: VoxelChunk,
  geometries: VoxelChunkCollision["geometries"] = kNoGeometries,
  layerOffset = { x: 0, y: 0, z: 0 }
): VoxelChunkCollision {
  return { chunk, geometries, layerOffset };
}

/** Stand-in for a built chunk geometry (one triangle). */
function makeGeometry(vertexCount = 3) {
  const positions = new Float32Array(vertexCount * 3).map((_, i) => i);
  const indices = new Uint32Array(
    Array.from({ length: vertexCount }, (_, i) => i)
  );

  return {
    getAttribute(name: string) {
      return name === "position"
        ? { array: positions, count: vertexCount }
        : null;
    },
    getIndex() {
      return { array: indices };
    },
    dispose() {
      // no-op
    }
  } as unknown as THREE.BufferGeometry;
}

describe("RapierVoxelCollider.rebuildChunk", () => {
  it("creates no body for an empty chunk", () => {
    const { collider, world } = makeCollider();

    collider.rebuildChunk("a", collisionOf(new VoxelChunk([0, 0, 0], 4)));

    assert.equal(world.rigidBodies.length, 0);
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

  it("creates one body and one cuboid per box voxel", () => {
    const chunk = new VoxelChunk([0, 0, 0], 4);
    chunk.set([0, 0, 0], { blockId: 1, transform: 0 });
    chunk.set([1, 0, 0], { blockId: 1, transform: 0 });
    const { collider, world } = makeCollider([makeBlockDef(1, "cube")]);

    collider.rebuildChunk("a", collisionOf(chunk));

    assert.equal(world.rigidBodies.length, 1);
    assert.equal(world.colliderCalls.length, 2);
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

  it("places the body at the chunk origin plus the layer offset", () => {
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

  it("falls back to cuboids when a trimesh shape has no geometry", () => {
    const chunk = new VoxelChunk([0, 0, 0], 4);
    chunk.set([0, 0, 0], { blockId: 1, transform: 0 });
    const { collider, world } = makeCollider([makeBlockDef(1, "ramp")]);

    collider.rebuildChunk("a", collisionOf(chunk));

    assert.equal(world.colliderCalls.length, 1);
    assert.deepEqual(
      world.colliderCalls[0].desc._translation,
      { x: 0.5, y: 0.5, z: 0.5 }
    );
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
