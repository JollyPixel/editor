// Import Internal Dependencies
import type { VoxelWorld } from "../../world/VoxelWorld.ts";
import type { VoxelLayer } from "../../world/VoxelLayer.ts";
import type { BlockVariantCache } from "../variants/BlockVariantCache.ts";
import { LayerChunkCache } from "./LayerChunkCache.ts";
import { FACE_OFFSETS, FACE_OPPOSITE } from "../../utils/math.ts";
import type {
  BlockVariant,
  BlockVariantFace
} from "../variants/types.ts";
import { splitBoundaryFace } from "./splitBoundaryFace.ts";
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
  /**
   * Supplies the reusable lookup window of the n-th non-empty layer, or null
   * to query chunk storage directly.
   */
  windowFor?: (index: number) => Int32Array | null;
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
    const {
      world,
      variants,
      layer,
      minWx,
      minWy,
      minWz,
      windowFor
    } = options;
    const layers: LayerChunkCache[] = [];
    const { chunkSize } = world;

    for (const candidate of world.getLayers()) {
      if (!candidate.visible || candidate.opacity === 0) {
        continue;
      }

      const cache = new LayerChunkCache({
        layer: candidate,
        chunkSize,
        minWx,
        minWy,
        minWz,
        window: windowFor?.(layers.length) ?? null
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

      const packed = layers[i].packedAt(wx, wy, wz);
      if (packed !== VOXEL_ABSENT && (
        layers[i].layer.compositing === "replace" ||
        this.#variants.get(voxelBlockId(packed), voxelTransform(packed))
          ?.occlusionMask === 0b111111
      )) {
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
    variant: BlockVariant
  ): boolean {
    if (!this.#selfOpaque) {
      const cache = this.#self;

      return cache !== null &&
        this.#occludes(cache.packedAt(nx, ny, nz), oppFace, variant);
    }

    const layers = this.layers;

    for (let i = 0; i < this.#layerCount; i++) {
      const cache = layers[i];
      if (!cache.opaque) {
        continue;
      }

      const neighbour = cache.packedAt(nx, ny, nz);
      if (neighbour !== VOXEL_ABSENT) {
        if (this.#occludes(neighbour, oppFace, variant)) {
          return true;
        }

        if (cache.layer.compositing === "replace") {
          return false;
        }
      }
    }

    return false;
  }

  isVacantAt(
    wx: number,
    wy: number,
    wz: number
  ): boolean {
    const layers = this.layers;

    for (let i = 0; i < this.#layerCount; i++) {
      if (layers[i].packedAt(wx, wy, wz) !== VOXEL_ABSENT) {
        return false;
      }
    }

    return true;
  }

  #occludes(
    neighbour: PackedVoxel,
    oppFace: number,
    variant: BlockVariant
  ): boolean {
    if (neighbour === VOXEL_ABSENT) {
      return false;
    }

    const neighbourBlockId = voxelBlockId(neighbour);
    const transform = voxelTransform(neighbour);

    if (neighbourBlockId !== variant.blockId) {
      if (variant.keepsCoveredFaces && variant.surface.side === "double") {
        return false;
      }

      const occlusionMask = this.#variants.occlusionMaskOf(
        neighbourBlockId,
        transform
      );

      return (occlusionMask & (1 << oppFace)) !== 0;
    }

    if (variant.keepsCoveredFaces) {
      return false;
    }

    const selfMask = this.#variants.selfOcclusionMaskOf(
      neighbourBlockId,
      transform
    );

    return (selfMask & (1 << oppFace)) !== 0;
  }

  boundaryFaces(
    face: BlockVariantFace,
    wx: number,
    wy: number,
    wz: number,
    variant: BlockVariant
  ): readonly BlockVariantFace[] {
    if (!face.splittable) {
      return [face];
    }
    const offset = FACE_OFFSETS[face.cull];
    const opposite = FACE_OPPOSITE[face.cull];
    let faces: readonly BlockVariantFace[] = [face];
    for (const cache of this.layers) {
      const packed = cache.packedAt(
        wx + offset[0],
        wy + offset[1],
        wz + offset[2]
      );
      if (packed === VOXEL_ABSENT) {
        continue;
      }
      const neighbour = this.#variants.get(
        voxelBlockId(packed), voxelTransform(packed)
      );
      if (neighbour) {
        for (const boundary of neighbour.faces) {
          if (boundary.cull !== opposite || (
            neighbour.surface.occludes && variant.keepsCoveredFaces
          )) {
            continue;
          }
          const remove = neighbour.blockId === variant.blockId &&
            !variant.keepsCoveredFaces && cache.layer === this.#self?.layer;
          faces = faces.flatMap((piece) => this.#split(piece, boundary, remove));
        }
      }
      if (cache.opaque && cache.layer.compositing === "replace") {
        break;
      }
    }

    return faces;
  }

  #split(
    face: BlockVariantFace,
    neighbour: BlockVariantFace,
    remove: boolean
  ): BlockVariantFace[] {
    if (face.full && neighbour.full) {
      return remove ? [] : [this.#variants.frontFaceOf(face)];
    }

    return splitBoundaryFace({
      face,
      neighbour,
      frontSlot: this.#variants.frontSlotOf(face.slot),
      remove
    });
  }
}
