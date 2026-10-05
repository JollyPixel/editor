// Import Internal Dependencies
import type { PackedVoxel } from "../../document/world/storage/packedVoxel.ts";
import type { VoxelCoord } from "../../document/world/types.ts";

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
  /**
   * RGBA floats, `PULLED_BLEND_TEXELS` texels per entry, entry 0 unused.
   * Present when faces use the blended four-word layout.
   */
  readonly blendPalette?: Float32Array<ArrayBuffer>;
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
  storedAt(
    lx: number,
    ly: number,
    lz: number
  ): PackedVoxel;
  getPartnerAt(
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
  readonly name?: string;
  readonly visible: boolean;
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

export interface MeshableLayerVisibility {
  isVisible(layer: MeshableLayer): boolean;
}

export const AUTHORED_LAYER_VISIBILITY: MeshableLayerVisibility = {
  isVisible: (layer) => layer.visible
};
