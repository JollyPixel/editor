// Import Internal Dependencies
import type { BlockVariantCache } from "./variants/BlockVariantCache.ts";
import type { MeshableChunk } from "./types.ts";
import type { MeshBuildStats } from "./MeshBuildStats.ts";
import type { ChunkNeighbourhood } from "./neighbourhood/ChunkNeighbourhood.ts";
import type { PulledFaceBuffer } from "./pulling/PulledFaceBuffer.ts";
import { FaceEmitter } from "./FaceEmitter.ts";
import {
  voxelBlockId,
  voxelTransform
} from "../../document/world/storage/packedVoxel.ts";

export interface ChunkMeshPass {
  chunk: MeshableChunk;
  neighbourhood: ChunkNeighbourhood;
  worldOriginX: number;
  worldOriginY: number;
  worldOriginZ: number;
  stats: MeshBuildStats;
  bufferFor: (slot: number, blended?: boolean) => PulledFaceBuffer;
  ambientOcclusion: boolean;
}

export class ChunkMesher {
  #variants: BlockVariantCache;

  constructor(
    variants: BlockVariantCache
  ) {
    this.#variants = variants;
  }

  mesh(
    pass: ChunkMeshPass
  ): void {
    const {
      chunk,
      neighbourhood,
      worldOriginX,
      worldOriginY,
      worldOriginZ,
      stats
    } = pass;
    const { shift, mask } = chunk;
    const shiftZ = shift * 2;
    const { keys, values, capacity } = chunk.store;
    const faces = new FaceEmitter(pass);

    for (let slot = 0; slot < capacity; slot++) {
      const linearIdx = keys[slot];
      if (linearIdx < 0) {
        continue;
      }

      const wx = worldOriginX + (linearIdx & mask);
      const wy = worldOriginY + ((linearIdx >> shift) & mask);
      const wz = worldOriginZ + (linearIdx >> shiftZ);

      stats.voxels++;
      if (!neighbourhood.winsCompositing(wx, wy, wz)) {
        stats.hiddenVoxels++;
        continue;
      }

      const packed = values[slot];
      const variant = this.#variants.get(
        voxelBlockId(packed),
        voxelTransform(packed)
      );
      if (variant === null) {
        continue;
      }

      for (const face of variant.faces) {
        faces.emitVisible(variant, face, wx, wy, wz);
      }
    }
  }
}
