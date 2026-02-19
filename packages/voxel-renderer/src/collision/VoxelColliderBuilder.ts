// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { VoxelChunk } from "../world/VoxelChunk.ts";
import type { BlockRegistry } from "../blocks/BlockRegistry.ts";
import type { BlockShapeRegistry } from "../blocks/BlockShapeRegistry.ts";
import { unpackTransform } from "../utils/math.ts";

/**
 * Minimal interface for Rapier3D static descriptors needed by this builder.
 * Using a structural interface avoids importing the WASM module at the library
 * level — the consumer provides the already-initialised Rapier namespace.
 */
export interface RapierColliderDesc {
  setTranslation(x: number, y: number, z: number): this;
}

export interface RapierRigidBody {
  readonly handle: number;
}

export interface RapierCollider {
  readonly handle: number;
}

export interface RapierWorld {
  createRigidBody(
    desc: RapierRigidBodyDesc
  ): RapierRigidBody;
  createCollider(
    desc: RapierColliderDesc,
    parent?: RapierRigidBody
  ): RapierCollider;
  removeCollider(
    collider: RapierCollider,
    wakeUp: boolean
  ): void;
  removeRigidBody(
    body: RapierRigidBody
  ): void;
}

export interface RapierRigidBodyDesc {
  setTranslation(x: number, y: number, z: number): this;
}

/** The subset of the Rapier module's static API required by this builder. */
export interface RapierAPI {
  RigidBodyDesc: {
    fixed(): RapierRigidBodyDesc;
  };
  ColliderDesc: {
    cuboid(
      hx: number,
      hy: number,
      hz: number
    ): RapierColliderDesc;
    trimesh(
      vertices: Float32Array,
      indices: Uint32Array
    ): RapierColliderDesc;
  };
}

export interface VoxelColliderBuilderOptions {
  rapier: RapierAPI;
  world: RapierWorld;
  blockRegistry: BlockRegistry;
  shapeRegistry: BlockShapeRegistry;
}

/**
 * Builds Rapier3D collision shapes for voxel chunks.
 *
 * Strategy selection per chunk:
 *   - If all solid blocks report collisionHint === "box" → compound cuboids
 *     (one cuboid per solid voxel, attached to a static RigidBody at the chunk origin).
 *   - If any block uses collisionHint === "trimesh" → single trimesh built from
 *     the chunk's already-computed THREE.BufferGeometry (cheaper than re-traversing).
 *   - If all blocks are "none" → no collider.
 *
 * Trimesh note: Rapier trimeshes are accurate for complex shapes but may suffer
 * ghost collisions on internal edges.  For full-cube worlds, compound cuboids
 * are significantly more robust and performant.
 */
export class VoxelColliderBuilder {
  #rapier: RapierAPI;
  #world: RapierWorld;
  #blockRegistry: BlockRegistry;
  #shapeRegistry: BlockShapeRegistry;

  constructor(
    options: VoxelColliderBuilderOptions
  ) {
    this.#rapier = options.rapier;
    this.#world = options.world;
    this.#blockRegistry = options.blockRegistry;
    this.#shapeRegistry = options.shapeRegistry;
  }

  /**
   * Builds (or re-builds) the collider for one chunk.
   * Returns the created Rapier Collider, or null if the chunk has no solid geometry.
   *
   * The caller is responsible for removing the old collider (if any) before calling this.
   */
  buildChunkCollider(
    chunk: VoxelChunk,
    geometry: THREE.BufferGeometry | null,
    layerOffset: { x: number; y: number; z: number; } = { x: 0, y: 0, z: 0 }
  ): RapierCollider | null {
    if (chunk.isEmpty()) {
      return null;
    }

    const chunkSize = chunk.size;
    const worldOriginX = chunk.cx * chunkSize + layerOffset.x;
    const worldOriginY = chunk.cy * chunkSize + layerOffset.y;
    const worldOriginZ = chunk.cz * chunkSize + layerOffset.z;

    // Scan all voxels to determine the optimal collider strategy.
    let hasTrimesh = false;
    let hasBox = false;
    const solidEntries: Array<{
      lx: number;
      ly: number;
      lz: number;
    }> = [];

    for (const [idx, entry] of chunk.entries()) {
      const blockDef = this.#blockRegistry.get(entry.blockId);
      if (!blockDef || !blockDef.collidable) {
        continue;
      }

      const { rotation } = unpackTransform(entry.transform);
      void rotation;

      const shape = this.#shapeRegistry.get(blockDef.shapeId);
      if (!shape || shape.collisionHint === "none") {
        continue;
      }

      const { lx, ly, lz } = chunk.fromLinearIndex(idx);
      solidEntries.push({ lx, ly, lz });

      if (shape.collisionHint === "trimesh") {
        hasTrimesh = true;
      }
      else {
        hasBox = true;
      }
    }

    if (solidEntries.length === 0) {
      return null;
    }

    // Create a static RigidBody at the chunk origin.
    const bodyDesc = this.#rapier.RigidBodyDesc.fixed()
      .setTranslation(worldOriginX, worldOriginY, worldOriginZ);
    const rigidBody = this.#world.createRigidBody(bodyDesc);

    // Use trimesh if any shape requires it; otherwise use compound cuboids.
    if (hasTrimesh && geometry !== null) {
      return this.#buildTrimesh(rigidBody, geometry);
    }

    if (hasBox || hasTrimesh) {
      return this.#buildCompoundCuboids(rigidBody, solidEntries);
    }

    // If we somehow reach here with nothing to build, clean up the body.
    this.#world.removeRigidBody(rigidBody);

    return null;
  }

  #buildTrimesh(
    rigidBody: RapierRigidBody,
    geometry: THREE.BufferGeometry
  ): RapierCollider | null {
    const posAttr = geometry.getAttribute("position");
    const indexAttr = geometry.getIndex();

    if (!posAttr || !indexAttr) {
      return null;
    }

    const vertices = new Float32Array(posAttr.array);
    const indices = new Uint32Array(indexAttr.array);

    const colliderDesc = this.#rapier.ColliderDesc.trimesh(
      vertices,
      indices
    );

    return this.#world.createCollider(
      colliderDesc,
      rigidBody
    );
  }

  #buildCompoundCuboids(
    rigidBody: RapierRigidBody,
    entries: Array<{
      lx: number;
      ly: number;
      lz: number;
    }>
  ): RapierCollider {
    // Each voxel becomes a 1×1×1 cuboid (half-extents = 0.5).
    // Positioned at block centre relative to chunk origin.
    const colliderDesc = this.#rapier.ColliderDesc.cuboid(
      0.5 * entries.length,
      0.5,
      0.5
    );

    // For a true compound shape we would use Rapier's CompoundShape builder,
    // but since that API varies by version we use one cuboid per block here.
    // TODO: upgrade to a proper compound collider when Rapier API stabilises.
    let lastCollider!: RapierCollider;
    for (const { lx, ly, lz } of entries) {
      const perVoxelDesc = this.#rapier.ColliderDesc
        .cuboid(0.5, 0.5, 0.5)
        .setTranslation(lx + 0.5, ly + 0.5, lz + 0.5);
      lastCollider = this.#world.createCollider(
        perVoxelDesc,
        rigidBody
      );
    }

    void colliderDesc;

    return lastCollider;
  }
}
