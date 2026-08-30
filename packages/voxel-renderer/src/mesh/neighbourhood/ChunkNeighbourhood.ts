// Import Internal Dependencies
import type { VoxelWorld } from "../../world/VoxelWorld.ts";
import type { VoxelLayer } from "../../world/VoxelLayer.ts";
import type { BlockVariantCache } from "../variants/BlockVariantCache.ts";
import { LayerChunkCache } from "./LayerChunkCache.ts";
import {
  voxelBlockId,
  voxelTransform,
  VOXEL_ABSENT
} from "../../world/packedVoxel.ts";

export interface ChunkNeighbourhoodOptions {
  world: VoxelWorld;
  variants: BlockVariantCache;
  layer: VoxelLayer;
  minWx: number;
  minWy: number;
  minWz: number;
}

/**
 * Provides compositing and occlusion queries over visible layers.
 */
export class ChunkNeighbourhood {
  readonly layers: readonly LayerChunkCache[];
  readonly selfIndex: number;

  #variants: BlockVariantCache;
  #layerCount: number;

  constructor(
    options: ChunkNeighbourhoodOptions
  ) {
    const { world, variants, layer, minWx, minWy, minWz } = options;
    const layers: LayerChunkCache[] = [];
    const { chunkSize } = world;

    for (const candidate of world.getLayers()) {
      if (!candidate.visible || candidate.opacity === 0) {
        continue;
      }

      const cache = new LayerChunkCache({
        layer: candidate, chunkSize, minWx, minWy, minWz
      });
      if (!cache.empty) {
        layers.push(cache);
      }
    }

    this.layers = layers;
    this.selfIndex = layers.findIndex(
      (cache) => cache.layer === layer
    );

    this.#variants = variants;
    this.#layerCount = layers.length;
  }

  /**
   * True when no higher-priority layer covers the position.
   */
  winsCompositing(
    wx: number,
    wy: number,
    wz: number
  ): boolean {
    const layers = this.layers;
    const selfIndex = this.selfIndex;

    for (let i = 0; i < this.#layerCount; i++) {
      if (i === selfIndex) {
        return true;
      }

      if (layers[i].packedAt(wx, wy, wz) !== VOXEL_ABSENT) {
        return false;
      }
    }

    return false;
  }

  /**
   * True when an opaque neighbour occludes `oppFace`.
   */
  isNeighbourFaceHidden(
    nx: number,
    ny: number,
    nz: number,
    oppFace: number
  ): boolean {
    const layers = this.layers;

    for (let i = 0; i < this.#layerCount; i++) {
      const cache = layers[i];
      const neighbour = cache.packedAt(nx, ny, nz);
      if (neighbour === VOXEL_ABSENT) {
        continue;
      }
      if (!cache.opaque) {
        return false;
      }

      const occlusionMask = this.#variants.occlusionMaskOf(
        voxelBlockId(neighbour),
        voxelTransform(neighbour)
      );

      return (occlusionMask & (1 << oppFace)) !== 0;
    }

    return false;
  }
}
