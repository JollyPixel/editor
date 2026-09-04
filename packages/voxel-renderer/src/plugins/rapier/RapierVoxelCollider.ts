// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type {
  VoxelCollider,
  VoxelChunkCollision
} from "../../collision/VoxelCollider.ts";
import { mergeChunkGeometries } from "../../collision/mergeChunkGeometries.ts";
import type { BlockRegistry } from "../../blocks/BlockRegistry.ts";
import type { BlockShapeRegistry } from "../../blocks/shape/BlockShapeRegistry.ts";
import type { VoxelChunk } from "../../world/VoxelChunk.ts";
import { voxelBlockId } from "../../world/packedVoxel.ts";
import type { VoxelCoord } from "../../world/types.ts";
import type {
  RapierAPI,
  RapierRigidBody,
  RapierWorld
} from "./RapierVoxelCollider.types.ts";

export interface RapierVoxelColliderOptions {
  api: RapierAPI;
  world: RapierWorld;
  blockRegistry: BlockRegistry;
  shapeRegistry: BlockShapeRegistry;
}

interface SolidVoxel {
  lx: number;
  ly: number;
  lz: number;
}

/**
 * Uses a trimesh when requested by any block; otherwise uses cuboids.
 */
export class RapierVoxelCollider implements VoxelCollider {
  #rapier: RapierAPI;
  #world: RapierWorld;
  #blockRegistry: BlockRegistry;
  #shapeRegistry: BlockShapeRegistry;

  #bodies = new Map<string, RapierRigidBody>();

  constructor(
    options: RapierVoxelColliderOptions
  ) {
    this.#rapier = options.api;
    this.#world = options.world;
    this.#blockRegistry = options.blockRegistry;
    this.#shapeRegistry = options.shapeRegistry;
  }

  rebuildChunk(
    key: string,
    collision: VoxelChunkCollision
  ): void {
    this.removeChunk(key);

    const body = this.#buildChunkBody(collision);
    if (body) {
      this.#bodies.set(key, body);
    }
  }

  removeChunk(
    key: string
  ): void {
    const body = this.#bodies.get(key);
    if (!body) {
      return;
    }

    this.#world.removeRigidBody(body);
    this.#bodies.delete(key);
  }

  dispose(): void {
    for (const body of this.#bodies.values()) {
      this.#world.removeRigidBody(body);
    }
    this.#bodies.clear();
  }

  #buildChunkBody(
    collision: VoxelChunkCollision
  ): RapierRigidBody | null {
    const { chunk, geometries, layerOffset } = collision;
    if (chunk.isEmpty()) {
      return null;
    }

    const { solids, hasTrimesh } = this.#collectSolids(chunk);
    if (solids.length === 0) {
      return null;
    }

    const body = this.#world.createRigidBody(
      this.#rapier.RigidBodyDesc
        .fixed()
        .setTranslation(...chunkOrigin(chunk, layerOffset))
    );

    if (hasTrimesh && this.#buildTrimesh(body, geometries)) {
      return body;
    }

    this.#buildCuboids(body, solids);

    return body;
  }

  #collectSolids(
    chunk: VoxelChunk
  ): { solids: SolidVoxel[]; hasTrimesh: boolean; } {
    const solids: SolidVoxel[] = [];
    let hasTrimesh = false;

    for (const [idx, packed] of chunk.packedEntries()) {
      const blockDef = this.#blockRegistry.get(voxelBlockId(packed));
      if (!blockDef?.collidable) {
        continue;
      }

      const shape = this.#shapeRegistry.get(blockDef.shapeId);
      if (!shape || shape.collisionHint === "none") {
        continue;
      }

      solids.push(chunk.fromLinearIndex(idx));
      if (shape.collisionHint === "trimesh") {
        hasTrimesh = true;
      }
    }

    return { solids, hasTrimesh };
  }

  #buildTrimesh(
    body: RapierRigidBody,
    geometries: ReadonlyMap<string, THREE.BufferGeometry>
  ): boolean {
    const merged = mergeChunkGeometries(geometries);
    if (!merged) {
      return false;
    }

    const { geometry, owned } = merged;
    try {
      const position = geometry.getAttribute("position");
      const index = geometry.getIndex();
      if (!position || !index) {
        return false;
      }

      this.#world.createCollider(
        this.#rapier.ColliderDesc.trimesh(
          new Float32Array(position.array),
          new Uint32Array(index.array)
        ),
        body
      );

      return true;
    }
    finally {
      if (owned) {
        geometry.dispose();
      }
    }
  }

  #buildCuboids(
    body: RapierRigidBody,
    solids: readonly SolidVoxel[]
  ): void {
    for (const { lx, ly, lz } of solids) {
      this.#world.createCollider(
        this.#rapier.ColliderDesc
          .cuboid(0.5, 0.5, 0.5)
          .setTranslation(lx + 0.5, ly + 0.5, lz + 0.5),
        body
      );
    }
  }
}

function chunkOrigin(
  chunk: VoxelChunk,
  layerOffset: VoxelCoord
): [x: number, y: number, z: number] {
  return [
    (chunk.cx * chunk.size) + layerOffset.x,
    (chunk.cy * chunk.size) + layerOffset.y,
    (chunk.cz * chunk.size) + layerOffset.z
  ];
}
