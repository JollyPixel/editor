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
import type { VoxelChunkCollision } from "../../../src/view/collision/index.ts";
import { VoxelChunk } from "../../../src/document/world/index.ts";
import { type BlockDefinition, BlockRegistry } from "../../../src/document/blocks/index.ts";
import { BlockShapeRegistry } from "../../../src/document/blocks/shape/index.ts";
import { Slab } from "../../../src/document/blocks/shape/library/Slab.ts";
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

describe("RapierVoxelCollider.rebuildChunk", () => {
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

  it("clears scratch cells when creating a collider throws", (t) => {
    const { collider, world } = makeCollider([makeBlockDef(1, "cube")]);
    const failure = new Error("Collider creation failed");
    const createCollider = t.mock.method(world, "createCollider", () => {
      throw failure;
    });

    assert.throws(
      () => collider.rebuildChunk("a", createCollision(makeChunk([[0, 0, 0], [2, 0, 0]]))),
      failure
    );
    createCollider.mock.restore();
    collider.rebuildChunk("b", createCollision(makeChunk([[1, 0, 0]])));

    assert.equal(world.colliderCalls.length, 1);
    assert.equal(world.colliderCalls[0].desc.hx, 0.5);
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

  it("places the body at the collision origin", () => {
    const { collider, rapier } = makeCollider([makeBlockDef(1, "cube")]);

    collider.rebuildChunk(
      "a",
      createCollision(makeChunk([[0, 0, 0]], 4, [2, 0, 1]), kNoGeometries, { x: 16, y: 0, z: 4 })
    );

    assert.equal(rapier.bodyDescs.length, 1);
    assert.deepEqual(rapier.bodyDescs[0].translation, { x: 16, y: 0, z: 4 });
  });
});
