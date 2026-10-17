// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  type RapierAPI,
  type RapierCollider,
  type RapierColliderDesc,
  type RapierRigidBody,
  type RapierRigidBodyDesc,
  RapierVoxelCollider
} from "../../../src/plugins/rapier/index.ts";
import type { VoxelChunkCollision } from "../../../src/view/collision/index.ts";
import { VoxelChunk } from "../../../src/document/world/index.ts";
import { type BlockDefinition, BlockRegistry } from "../../../src/document/blocks/index.ts";
import { BlockShapeRegistry } from "../../../src/document/blocks/shape/index.ts";
import { makeBlockDef } from "../../helpers/blocks.ts";

// CONSTANTS
const kNoGeometries = new Map();

type Translation = { x: number; y: number; z: number; } | null;
type Cell = [number, number, number, number?, number?];

interface RecordedDesc extends RapierColliderDesc, RapierRigidBodyDesc {
  hx?: number;
  hy?: number;
  hz?: number;
  vertices?: Float32Array;
  indices?: Uint32Array;
  translation: Translation;
}

function makeDesc(
  fields: Partial<RecordedDesc> = {}
): RecordedDesc {
  return {
    ...fields,
    translation: null,
    setTranslation(x: number, y: number, z: number) {
      this.translation = { x, y, z };

      return this;
    }
  };
}

function makeMockWorld() {
  const rigidBodies: RapierRigidBody[] = [];
  const colliderCalls: { desc: RecordedDesc; parent: RapierRigidBody | undefined; }[] = [];
  const removedBodies: RapierRigidBody[] = [];

  return {
    rigidBodies,
    colliderCalls,
    removedBodies,
    get liveBodies() {
      return rigidBodies.filter((body) => !removedBodies.includes(body));
    },
    createRigidBody(_desc: RapierRigidBodyDesc): RapierRigidBody {
      const body = { handle: rigidBodies.length };
      rigidBodies.push(body);

      return body;
    },
    createCollider(desc: RecordedDesc, parent?: RapierRigidBody): RapierCollider {
      colliderCalls.push({ desc, parent });

      return { handle: colliderCalls.length - 1 };
    },
    removeCollider: () => void 0,
    removeRigidBody(body: RapierRigidBody): void {
      removedBodies.push(body);
    }
  };
}

function makeMockRapier(): RapierAPI & { bodyDescs: RecordedDesc[]; } {
  const bodyDescs: RecordedDesc[] = [];

  return {
    bodyDescs,
    RigidBodyDesc: {
      fixed() {
        const desc = makeDesc();
        bodyDescs.push(desc);

        return desc;
      }
    },
    ColliderDesc: {
      cuboid: (hx, hy, hz) => makeDesc({ hx, hy, hz }),
      trimesh: (vertices, indices) => makeDesc({ vertices, indices })
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
    api: rapier,
    world,
    blockRegistry: new BlockRegistry(blocks),
    shapeRegistry
  });

  return { collider, world, rapier, shapeRegistry };
}

function makeChunk(
  cells: Cell[],
  size = 4,
  coords: [number, number, number] = [0, 0, 0]
): VoxelChunk {
  const chunk = new VoxelChunk(coords, size);
  for (const [x, y, z, blockId = 1, transform = 0] of cells) {
    chunk.set([x, y, z], { blockId, transform });
  }

  return chunk;
}

function createCollision(
  chunks: VoxelChunk | VoxelChunk[],
  geometries: VoxelChunkCollision["geometries"] = kNoGeometries,
  origin = { x: 0, y: 0, z: 0 }
): VoxelChunkCollision {
  return {
    origin,
    chunks: Array.isArray(chunks) ? chunks : [chunks],
    geometries
  };
}

describe("RapierVoxelCollider.removeChunk", () => {
  it("removes the chunk's rigid body from the world", () => {
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

describe("RapierVoxelCollider.dispose", () => {
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
