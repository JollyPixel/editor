// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type { BlockRegistry } from "../blocks/BlockRegistry.ts";
import type { BlockShapeRegistry } from "../blocks/BlockShapeRegistry.ts";
import type { VoxelChunk } from "../world/VoxelChunk.ts";
import type { VoxelCoord } from "../world/types.ts";

export interface VoxelChunkCollision {
  chunk: VoxelChunk;
  /**
   * Keyed by tileset id (one draw call per texture). Collision is
   * texture-agnostic: merge via `mergeChunkGeometries()` or ignore.
   */
  geometries: ReadonlyMap<string, THREE.BufferGeometry>;
  layerOffset: VoxelCoord;
}

/**
 * Physics-agnostic collision sink driven by `VoxelEngine`.
 *
 * No physics handle crosses this boundary: implementations key their own
 * bookkeeping on the opaque `key` the engine passes back.
 */
export interface VoxelCollider {
  /** Replaces anything previously registered under `key`. */
  rebuildChunk(
    key: string,
    collision: VoxelChunkCollision
  ): void;

  /** No-op for unknown keys. */
  removeChunk(
    key: string
  ): void;

  dispose(): void;
}

export interface VoxelColliderContext {
  blockRegistry: BlockRegistry;
  shapeRegistry: BlockShapeRegistry;
}

export type VoxelColliderFactory = (
  context: VoxelColliderContext
) => VoxelCollider;
