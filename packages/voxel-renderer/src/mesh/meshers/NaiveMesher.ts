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
import { FaceEmitter } from "./FaceEmitter.ts";

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
    pass: MeshPassOptions
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
