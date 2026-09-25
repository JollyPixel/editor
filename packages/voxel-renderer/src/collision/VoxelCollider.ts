// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type { BlockRegistry } from "../blocks/BlockRegistry.ts";
import type { BlockShapeRegistry } from "../blocks/shape/BlockShapeRegistry.ts";
import type { ChunkGeometryKey } from "../mesh/ChunkGeometryKey.ts";
import type { VoxelChunk } from "../world/VoxelChunk.ts";
import type { VoxelCoord } from "../world/types.ts";

export interface VoxelChunkCollision {
  chunk: VoxelChunk;
  /**
   * Per draw group geometry that collision adapters may merge or ignore;
   * empty when the chunk draws no face. Vertex positions are relative to the
   * chunk origin, `chunk` coordinates times its size plus `layerPosition`.
   */
  geometries: ReadonlyMap<ChunkGeometryKey, THREE.BufferGeometry>;
  layerPosition: VoxelCoord;
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
