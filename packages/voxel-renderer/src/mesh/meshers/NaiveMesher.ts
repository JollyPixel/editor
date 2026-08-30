// Import Internal Dependencies
import type { BlockVariantCache } from "../variants/BlockVariantCache.ts";
import type {
  Mesher,
  MeshPassOptions
} from "../types.ts";
import {
  voxelBlockId,
  voxelTransform
} from "../../world/packedVoxel.ts";
import {
  FACE_OFFSETS,
  FACE_OPPOSITE
} from "../../utils/math.ts";

/**
 * Emits every visible face of every voxel without merging.
 */
export class NaiveMesher implements Mesher {
  #variants: BlockVariantCache;

  constructor(
    variants: BlockVariantCache
  ) {
    this.#variants = variants;
  }

  mesh(
    options: MeshPassOptions
  ): boolean {
    const {
      chunk,
      neighbourhood,
      worldOriginX,
      worldOriginY,
      worldOriginZ,
      stats,
      bufferFor
    } = options;
    const { shift, mask } = chunk;
    const shiftZ = shift * 2;
    const { keys, values, capacity } = chunk.store;
    let emitted = false;

    for (let slot = 0; slot < capacity; slot++) {
      const linearIdx = keys[slot];
      if (linearIdx < 0) {
        continue;
      }

      const lx = linearIdx & mask;
      const ly = (linearIdx >> shift) & mask;
      const lz = linearIdx >> shiftZ;

      const wx = worldOriginX + lx;
      const wy = worldOriginY + ly;
      const wz = worldOriginZ + lz;

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
        const { cull } = face;
        if (cull >= 0) {
          const offset = FACE_OFFSETS[cull];
          const hidden = neighbourhood.isNeighbourFaceHidden(
            wx + offset[0],
            wy + offset[1],
            wz + offset[2],
            FACE_OPPOSITE[cull]
          );
          if (hidden) {
            stats.culledFaces++;
            continue;
          }
        }

        bufferFor(face.slot).addFace(face, wx, wy, wz);
        stats.faces++;
        emitted = true;
      }
    }

    return emitted;
  }
}
