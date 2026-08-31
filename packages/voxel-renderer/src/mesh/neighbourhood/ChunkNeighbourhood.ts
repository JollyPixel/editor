// Import Internal Dependencies
import type { VoxelWorld } from "../../world/VoxelWorld.ts";
import type { VoxelLayer } from "../../world/VoxelLayer.ts";
import type { BlockVariantCache } from "../variants/BlockVariantCache.ts";
import { LayerChunkCache } from "./LayerChunkCache.ts";
import {
  voxelBlockId,
  voxelTransform,
  VOXEL_ABSENT,
  type PackedVoxel
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
  #selfOpaque: boolean;
  #self: LayerChunkCache | null;

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
    this.#selfOpaque = layer.opacity >= 1;
    this.#self = layers[this.selfIndex] ?? null;
  }

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

      if (!layers[i].opaque) {
        continue;
      }

      if (layers[i].packedAt(wx, wy, wz) !== VOXEL_ABSENT) {
        return false;
      }
    }

    return false;
  }

  isNeighbourFaceHidden(
    nx: number,
    ny: number,
    nz: number,
    oppFace: number,
    blockId: number
  ): boolean {
    if (!this.#selfOpaque) {
      const cache = this.#self;

      return cache !== null &&
        this.#occludes(cache.packedAt(nx, ny, nz), oppFace, blockId);
    }

    const layers = this.layers;

    for (let i = 0; i < this.#layerCount; i++) {
      const cache = layers[i];
      if (!cache.opaque) {
        continue;
      }

      const neighbour = cache.packedAt(nx, ny, nz);
      if (neighbour !== VOXEL_ABSENT) {
        return this.#occludes(neighbour, oppFace, blockId);
      }
    }

    return false;
  }

  #occludes(
    neighbour: PackedVoxel,
    oppFace: number,
    blockId: number
  ): boolean {
    if (neighbour === VOXEL_ABSENT) {
      return false;
    }

    const neighbourBlockId = voxelBlockId(neighbour);
    const transform = voxelTransform(neighbour);
    const occlusionMask = neighbourBlockId === blockId ?
      this.#variants.selfOcclusionMaskOf(neighbourBlockId, transform) :
      this.#variants.occlusionMaskOf(neighbourBlockId, transform);

    return (occlusionMask & (1 << oppFace)) !== 0;
  }
}
