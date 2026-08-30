// Import Internal Dependencies
import type { VoxelChunk } from "../world/VoxelChunk.ts";
import type { GeometryBuffer } from "./GeometryBuffer.ts";
import type { MeshBuildStats } from "./MeshBuildStats.ts";
import type { ChunkNeighbourhood } from "./neighbourhood/ChunkNeighbourhood.ts";

export type GeometryBufferFactory = (slot: number) => GeometryBuffer;

export interface MeshPassOptions {
  chunk: VoxelChunk;
  neighbourhood: ChunkNeighbourhood;
  worldOriginX: number;
  worldOriginY: number;
  worldOriginZ: number;
  stats: MeshBuildStats;
  bufferFor: GeometryBufferFactory;
}

/**
 * Emits chunk geometry into the pass buffers; true when it wrote a face.
 */
export interface Mesher {
  mesh(options: MeshPassOptions): boolean;
}
