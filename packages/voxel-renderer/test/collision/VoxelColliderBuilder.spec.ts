// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelColliderBuilder } from "../../src/collision/VoxelColliderBuilder.ts";
import { VoxelChunk } from "../../src/world/VoxelChunk.ts";
import { BlockRegistry } from "../../src/blocks/BlockRegistry.ts";
import { BlockShapeRegistry } from "../../src/blocks/BlockShapeRegistry.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Mock helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeColliderDesc(hx: number, hy: number, hz: number) {
  return {
    hx, hy, hz,
    _translation: null as null | { x: number; y: number; z: number; },
    setTranslation(x: number, y: number, z: number) {
      this._translation = { x, y, z };

      return this;
    }
  };
}

function makeRigidBodyDesc() {
  return {
    _translation: null as null | { x: number; y: number; z: number; },
    setTranslation(x: number, y: number, z: number) {
      this._translation = { x, y, z };

      return this;
    }
  };
}

interface MockCall {
  desc: ReturnType<typeof makeColliderDesc>;
  parent: ReturnType<typeof makeRigidBody> | undefined;
}

function makeRigidBody(handle: number) {
  return { handle };
}

function makeMockWorld() {
  const rigidBodies: ReturnType<typeof makeRigidBody>[] = [];
  const colliderCalls: MockCall[] = [];
  const removedBodies: ReturnType<typeof makeRigidBody>[] = [];

  return {
    rigidBodies,
    colliderCalls,
    removedBodies,

    createRigidBody(_desc: any) {
      const body = makeRigidBody(rigidBodies.length);
      rigidBodies.push(body);

      return body;
    },
    createCollider(desc: any, parent?: any) {
      const handle = colliderCalls.length;
      colliderCalls.push({ desc, parent });

      return { handle };
    },
    removeCollider(_collider: any, _wakeUp: boolean) {
      // No-op for now, but we could track removed colliders if needed.
    },
    removeRigidBody(body: any) {
      removedBodies.push(body);
    }
  };
}

function makeMockRapier() {
  return {
    RigidBodyDesc: {
      fixed() {
        return makeRigidBodyDesc();
      }
    },
    ColliderDesc: {
      cuboid(hx: number, hy: number, hz: number) {
        return makeColliderDesc(hx, hy, hz);
      },
      trimesh(vertices: Float32Array, indices: Uint32Array) {
        return { vertices, indices };
      }
    }
  };
}

function makeBlockDef(id: number, shapeId: string, collidable = true) {
  return {
    id,
    name: `Block${id}`,
    shapeId: shapeId as any,
    faceTextures: {},
    defaultTexture: { col: 0, row: 0, tilesetId: "atlas" },
    collidable
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("VoxelColliderBuilder.buildChunkCollider", () => {
  it("returns null for an empty chunk", () => {
    const chunk = new VoxelChunk([0, 0, 0], 4);
    const mockWorld = makeMockWorld();
    const builder = new VoxelColliderBuilder({
      rapier: makeMockRapier() as any,
      world: mockWorld as any,
      blockRegistry: new BlockRegistry(),
      shapeRegistry: BlockShapeRegistry.createDefault()
    });

    const result = builder.buildChunkCollider(chunk, null);
    assert.equal(result, null);
    assert.equal(mockWorld.rigidBodies.length, 0);
  });

  it("returns null when the only block is not collidable", () => {
    const chunk = new VoxelChunk([0, 0, 0], 4);
    chunk.set([0, 0, 0], { blockId: 1, transform: 0 });

    const blockReg = new BlockRegistry([makeBlockDef(1, "cube", false)]);
    const shapeReg = BlockShapeRegistry.createDefault();
    const mockWorld = makeMockWorld();

    const builder = new VoxelColliderBuilder({
      rapier: makeMockRapier() as any,
      world: mockWorld as any,
      blockRegistry: blockReg,
      shapeRegistry: shapeReg
    });

    const result = builder.buildChunkCollider(chunk, null);
    assert.equal(result, null);
  });

  it("returns null when the block has an unknown blockId (not registered)", () => {
    const chunk = new VoxelChunk([0, 0, 0], 4);
    chunk.set([0, 0, 0], { blockId: 99, transform: 0 });

    const mockWorld = makeMockWorld();
    const builder = new VoxelColliderBuilder({
      rapier: makeMockRapier() as any,
      world: mockWorld as any,
      blockRegistry: new BlockRegistry(),
      shapeRegistry: BlockShapeRegistry.createDefault()
    });

    const result = builder.buildChunkCollider(chunk, null);
    assert.equal(result, null);
  });

  it("compound cuboid path: creates one RigidBody and N colliders for N box voxels", () => {
    const chunk = new VoxelChunk([0, 0, 0], 4);
    chunk.set([0, 0, 0], { blockId: 1, transform: 0 });
    chunk.set([1, 0, 0], { blockId: 1, transform: 0 });

    const blockReg = new BlockRegistry([makeBlockDef(1, "cube", true)]);
    const shapeReg = BlockShapeRegistry.createDefault();
    const mockWorld = makeMockWorld();

    const builder = new VoxelColliderBuilder({
      rapier: makeMockRapier() as any,
      world: mockWorld as any,
      blockRegistry: blockReg,
      shapeRegistry: shapeReg
    });

    builder.buildChunkCollider(chunk, null);

    assert.equal(mockWorld.rigidBodies.length, 1, "expected 1 rigid body");
    // Currently #buildCompoundCuboids creates one cuboid per voxel.
    // Known bug: returns only the last collider.
    assert.equal(
      mockWorld.colliderCalls.length, 2, "expected 1 createCollider call per voxel (current behaviour, see TODO in source)"
    );
  });

  it("each cuboid collider is positioned at voxel centre (local + 0.5)", () => {
    const chunk = new VoxelChunk([0, 0, 0], 4);
    chunk.set([2, 3, 1], { blockId: 1, transform: 0 });

    const blockReg = new BlockRegistry([makeBlockDef(1, "cube", true)]);
    const shapeReg = BlockShapeRegistry.createDefault();
    const mockWorld = makeMockWorld();

    const builder = new VoxelColliderBuilder({
      rapier: makeMockRapier() as any,
      world: mockWorld as any,
      blockRegistry: blockReg,
      shapeRegistry: shapeReg
    });

    builder.buildChunkCollider(chunk, null);

    // The single collider should have translation (lx+0.5, ly+0.5, lz+0.5) = (2.5, 3.5, 1.5)
    const call = mockWorld.colliderCalls[0];
    assert.deepEqual(call.desc._translation, { x: 2.5, y: 3.5, z: 1.5 });
  });

  it("trimesh path: uses geometry when any shape has collisionHint=trimesh", () => {
    // THREE.BufferGeometry — import dynamically to avoid module-level side effects
    const chunk = new VoxelChunk([0, 0, 0], 4);
    chunk.set([0, 0, 0], { blockId: 1, transform: 0 });

    const blockReg = new BlockRegistry([makeBlockDef(1, "ramp", true)]);
    const shapeReg = BlockShapeRegistry.createDefault();
    const mockWorld = makeMockWorld();

    // Build a minimal geometry stub with position + index attributes
    const geometry = {
      getAttribute(name: string) {
        if (name === "position") {
          return { array: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]) };
        }

        return null;
      },
      getIndex() {
        return { array: new Uint32Array([0, 1, 2]) };
      }
    };

    const builder = new VoxelColliderBuilder({
      rapier: makeMockRapier() as any,
      world: mockWorld as any,
      blockRegistry: blockReg,
      shapeRegistry: shapeReg
    });

    const result = builder.buildChunkCollider(chunk, geometry as any);

    assert.ok(result !== null, "expected a collider to be created");
    assert.equal(mockWorld.rigidBodies.length, 1);
    assert.equal(mockWorld.colliderCalls.length, 1);
    // The desc should be a trimesh (has .vertices and .indices)
    const desc = mockWorld.colliderCalls[0].desc as any;
    assert.ok(desc.vertices instanceof Float32Array);
  });

  it("rigid body origin accounts for chunk coords and layerOffset", () => {
    // chunk (cx=2, cy=0, cz=1) with chunkSize=4 and layerOffset={x:8, y:0, z:0}
    // expected world origin: x=2*4+8=16, y=0*4+0=0, z=1*4+0=4
    const chunk = new VoxelChunk([2, 0, 1], 4);
    chunk.set([0, 0, 0], { blockId: 1, transform: 0 });

    const blockReg = new BlockRegistry([makeBlockDef(1, "cube", true)]);
    const shapeReg = BlockShapeRegistry.createDefault();
    const mockWorld = makeMockWorld();
    const mockRapier = makeMockRapier();
    const capturedDescs: any[] = [];

    const patchedRapier = {
      ...mockRapier,
      RigidBodyDesc: {
        fixed() {
          const desc = mockRapier.RigidBodyDesc.fixed();
          capturedDescs.push(desc);

          return desc;
        }
      }
    };

    const builder = new VoxelColliderBuilder({
      rapier: patchedRapier as any,
      world: mockWorld as any,
      blockRegistry: blockReg,
      shapeRegistry: shapeReg
    });

    builder.buildChunkCollider(chunk, null, { x: 8, y: 0, z: 0 });

    assert.equal(capturedDescs.length, 1);
    assert.deepEqual(capturedDescs[0]._translation, { x: 16, y: 0, z: 4 });
  });
});
