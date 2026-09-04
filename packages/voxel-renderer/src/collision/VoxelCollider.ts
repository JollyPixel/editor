// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type { BlockRegistry } from "../blocks/BlockRegistry.ts";
import type { BlockShapeRegistry } from "../blocks/shape/BlockShapeRegistry.ts";
import type { VoxelChunk } from "../world/VoxelChunk.ts";
import type { VoxelCoord } from "../world/types.ts";

export interface VoxelChunkCollision {
  chunk: VoxelChunk;
  /**
   * Per-tileset geometry that collision adapters may merge or ignore.
   */
  geometries: ReadonlyMap<string, THREE.BufferGeometry>;
  layerOffset: VoxelCoord;
}

/**
 * Physics adapter keyed by opaque chunk IDs from `VoxelEngine`.
 */
export interface VoxelCollider {
  rebuildChunk(
    key: string,
    collision: VoxelChunkCollision
  ): void;

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
