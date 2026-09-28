// Import Internal Dependencies
import type { PackedVoxel } from "../world/packedVoxel.ts";
import type { VoxelCoord } from "../world/types.ts";
import type { MeshBuildStats } from "./MeshBuildStats.ts";
import type { ChunkNeighbourhood } from "./neighbourhood/ChunkNeighbourhood.ts";
import type { PulledFaceBuffer } from "./pulling/PulledFaceBuffer.ts";

export type PulledMeshBounds = readonly [
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number
];

export interface PulledMeshData {
  readonly vertexCount: number;
  readonly triangleCount: number;
  readonly bytesPerVertex: number;
  readonly words: Uint32Array<ArrayBuffer>;
  readonly faceCount: number;
  readonly bounds: PulledMeshBounds;
}

export interface MeshableStore {
  readonly keys: Int32Array;
  readonly values: Uint32Array;
  readonly capacity: number;
}

export interface MeshableChunk {
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;
  readonly size: number;
  readonly shift: number;
  readonly mask: number;
  readonly store: MeshableStore;
  readonly voxelCount: number;
  getPackedAt(
    lx: number,
    ly: number,
    lz: number
  ): PackedVoxel;
  mayContain(
    lx: number,
    ly: number,
    lz: number
  ): boolean;
}

export interface MeshableLayer {
  readonly effectivelyVisible: boolean;
  readonly opacity: number;
  readonly compositing: "replace" | "composite";
  readonly position: Readonly<VoxelCoord>;
  getChunk(
    cx: number,
    cy: number,
    cz: number
  ): MeshableChunk | undefined;
}

export interface MeshableLayerChunk {
  layer: MeshableLayer;
  chunk: MeshableChunk;
}

export interface MeshableWorld {
  readonly chunkSize: number;
  getLayers(): readonly MeshableLayer[];
}

export interface MeshPassOptions {
  chunk: MeshableChunk;
  neighbourhood: ChunkNeighbourhood;
  worldOriginX: number;
  worldOriginY: number;
  worldOriginZ: number;
  stats: MeshBuildStats;
  bufferFor: (slot: number) => PulledFaceBuffer;
  /**
   * Bakes per-vertex ambient occlusion into emitted faces.
   */
  ambientOcclusion: boolean;
}
