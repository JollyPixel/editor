// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type { VoxelChunk } from "../world/VoxelChunk.ts";
import type { VoxelLayer } from "../world/VoxelLayer.ts";
import type { MeshBuildStats } from "./MeshBuildStats.ts";
import type { QuadIndex } from "./QuadIndex.ts";
import type { BlockVariantFace } from "./variants/types.ts";
import type { ChunkNeighbourhood } from "./neighbourhood/ChunkNeighbourhood.ts";

export interface FaceBuffer {
  readonly vertexCount: number;
  readonly triangleCount: number;
  readonly bytesPerVertex: number;
  reset(
    originX?: number,
    originY?: number,
    originZ?: number
  ): void;
  addFace(
    face: BlockVariantFace,
    wx: number,
    wy: number,
    wz: number,
    ao?: number
  ): void;
  toGeometry(
    quadIndex: QuadIndex
  ): THREE.BufferGeometry;
}

export type FaceBufferFactory<TBuffer extends FaceBuffer = FaceBuffer> = (
  slot: number
) => TBuffer;

export interface MeshableWorld {
  readonly chunkSize: number;
  getLayers(): readonly VoxelLayer[];
}

export interface MeshPassOptions<TBuffer extends FaceBuffer = FaceBuffer> {
  chunk: VoxelChunk;
  neighbourhood: ChunkNeighbourhood;
  worldOriginX: number;
  worldOriginY: number;
  worldOriginZ: number;
  stats: MeshBuildStats;
  bufferFor: FaceBufferFactory<TBuffer>;
  /**
   * Bakes per-vertex ambient occlusion into emitted faces.
   */
  ambientOcclusion: boolean;
}

/**
 * Emits chunk geometry into the pass buffers.
 */
export interface Mesher<TBuffer extends FaceBuffer = FaceBuffer> {
  mesh(pass: MeshPassOptions<TBuffer>): void;
}
