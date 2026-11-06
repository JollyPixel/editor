// Import Third-party Dependencies
import type {
  BodyDesc,
  BodyKind,
  ColliderDesc,
  PhysicsBody,
  PhysicsCollider,
  PhysicsWorld,
  QuaternionLike,
  Vector3Like
} from "@jolly-pixel/physics";

// Import Internal Dependencies
import {
  PhysicsVoxelCollider,
  type VoxelChunkCollision
} from "../../src/view/collision/index.ts";
import { VoxelChunk } from "../../src/document/world/index.ts";
import {
  type BlockDefinition,
  BlockRegistry
} from "../../src/document/blocks/index.ts";
import { BlockShapeRegistry } from "../../src/document/blocks/shape/index.ts";

// CONSTANTS
const kNoGeometries = new Map();

export type Cell = [number, number, number, number?, number?];

export interface RecordedDesc {
  hx?: number;
  hy?: number;
  hz?: number;
  vertices?: Float32Array;
  indices?: Uint32Array;
  translation: Vector3Like | null;
}

function recordDesc(
  { shape, offset }: ColliderDesc
): RecordedDesc {
  const translation = offset ?? null;

  switch (shape.type) {
    case "box":
      return {
        hx: shape.halfExtents.x,
        hy: shape.halfExtents.y,
        hz: shape.halfExtents.z,
        translation
      };
    case "trimesh":
      return {
        vertices: shape.vertices,
        indices: shape.indices,
        translation
      };
    default:
      throw new TypeError(`The voxel collider never attaches a ${shape.type}.`);
  }
}

export class RecordedBody implements PhysicsBody {
  readonly kind: BodyKind;
  readonly position: Vector3Like;
  readonly rotation: QuaternionLike = { x: 0, y: 0, z: 0, w: 1 };
  linearVelocity: Vector3Like = { x: 0, y: 0, z: 0 };
  angularVelocity: Vector3Like = { x: 0, y: 0, z: 0 };

  #world: RecordingWorld;

  constructor(
    world: RecordingWorld,
    desc: BodyDesc
  ) {
    this.kind = desc.kind;
    this.position = { ...desc.position ?? { x: 0, y: 0, z: 0 } };
    this.#world = world;
  }

  teleport(): void {
    return;
  }

  moveTo(): void {
    return;
  }

  applyImpulse(): void {
    return;
  }

  applyForce(): void {
    return;
  }

  attach(
    desc: ColliderDesc
  ): PhysicsCollider {
    this.#world.colliderCalls.push({ desc: recordDesc(desc), parent: this });

    return {
      body: this,
      sensor: false,
      detach: () => undefined
    };
  }

  remove(): void {
    this.#world.removedBodies.push(this);
  }
}

export class RecordingWorld implements Pick<PhysicsWorld, "createBody"> {
  readonly rigidBodies: RecordedBody[] = [];
  readonly colliderCalls: { desc: RecordedDesc; parent: RecordedBody; }[] = [];
  readonly removedBodies: RecordedBody[] = [];

  get liveBodies(): RecordedBody[] {
    return this.rigidBodies.filter((body) => !this.removedBodies.includes(body));
  }

  createBody(
    desc: BodyDesc
  ): RecordedBody {
    const body = new RecordedBody(this, desc);
    this.rigidBodies.push(body);

    return body;
  }
}

export function makeCollider(
  blocks: BlockDefinition[] = []
) {
  const world = new RecordingWorld();
  const shapeRegistry = BlockShapeRegistry.createDefault();
  const collider = new PhysicsVoxelCollider({
    world,
    blockRegistry: new BlockRegistry(blocks),
    shapeRegistry
  });

  return { collider, world, shapeRegistry };
}

export function makeChunk(
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

export function createCollision(
  chunks: VoxelChunk | VoxelChunk[],
  origin = { x: 0, y: 0, z: 0 }
): VoxelChunkCollision {
  return {
    origin,
    chunks: Array.isArray(chunks) ? chunks : [chunks],
    geometries: kNoGeometries
  };
}
