// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type {
  VoxelCollider,
  VoxelChunkCollision
} from "../../collision/VoxelCollider.ts";
import { mergeChunkGeometries } from "../../collision/mergeChunkGeometries.ts";
import type { BlockRegistry } from "../../blocks/BlockRegistry.ts";
import type { BlockShapeRegistry } from "../../blocks/BlockShapeRegistry.ts";
import type { VoxelChunk } from "../../world/VoxelChunk.ts";
import type { VoxelCoord } from "../../world/types.ts";
import type {
  RapierAPI,
  RapierRigidBody,
  RapierWorld
} from "./RapierVoxelCollider.types.ts";

export interface RapierVoxelColliderOptions {
  /** Rapier3D module (static API). */
  api: RapierAPI;
  /** Rapier3D world instance. */
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
 * Rapier3D implementation of `VoxelCollider`. Strategy per chunk:
 *   - any block hints "trimesh" → one trimesh from the chunk's built geometry.
 *   - otherwise → one cuboid per voxel, both parented to a static body.
 *   - all blocks "none" → no collider.
 *
 * Trimeshes are accurate for sloped shapes but can ghost-collide on internal
 * edges; cuboids are more robust and performant for full-cube worlds.
 */
export class RapierVoxelCollider implements VoxelCollider {
  #rapier: RapierAPI;
  #world: RapierWorld;
  #blockRegistry: BlockRegistry;
  #shapeRegistry: BlockShapeRegistry;

  /** Chunk key → static body; removing it drops its attached colliders too. */
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

  /** Returns null when the chunk holds no collidable voxel. */
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

  /** A single trimesh hint upgrades the whole chunk to the trimesh strategy. */
  #collectSolids(
    chunk: VoxelChunk
  ): { solids: SolidVoxel[]; hasTrimesh: boolean; } {
    const solids: SolidVoxel[] = [];
    let hasTrimesh = false;

    for (const [idx, entry] of chunk.entries()) {
      const blockDef = this.#blockRegistry.get(entry.blockId);
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

  /** False when no usable triangle exists, so the caller falls back to cuboids. */
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

  /** One 1×1×1 cuboid per voxel, positioned relative to the body's chunk origin. */
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
