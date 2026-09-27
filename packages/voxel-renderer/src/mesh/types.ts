// Import Internal Dependencies
import type { PackedVoxel } from "../world/packedVoxel.ts";
import type { VoxelCoord } from "../world/types.ts";
import type { MeshBuildStats } from "./MeshBuildStats.ts";
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
  toMeshData(): ChunkMeshData;
}

export type ChunkMeshArray =
  | Float32Array<ArrayBuffer>
  | Int8Array<ArrayBuffer>
  | Uint16Array<ArrayBuffer>;

export interface ChunkMeshAttribute {
  readonly name: string;
  readonly array: ChunkMeshArray;
  readonly itemSize: number;
  readonly normalized: boolean;
}

interface MeshDataCounts {
  readonly vertexCount: number;
  readonly triangleCount: number;
  readonly bytesPerVertex: number;
}

export interface QuadMeshData extends MeshDataCounts {
  readonly kind: "quads";
  readonly attributes: readonly ChunkMeshAttribute[];
  readonly quadCount: number;
}

export type PulledMeshBounds = readonly [
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number
];

export interface PulledMeshData extends MeshDataCounts {
  readonly kind: "pulled";
  readonly words: Uint32Array<ArrayBuffer>;
  readonly faceCount: number;
  readonly bounds: PulledMeshBounds;
}

export type ChunkMeshData =
  | QuadMeshData
  | PulledMeshData;

export type FaceBufferFactory<TBuffer extends FaceBuffer = FaceBuffer> = (
  slot: number
) => TBuffer;

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

export interface MeshPassOptions<TBuffer extends FaceBuffer = FaceBuffer> {
  chunk: MeshableChunk;
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
