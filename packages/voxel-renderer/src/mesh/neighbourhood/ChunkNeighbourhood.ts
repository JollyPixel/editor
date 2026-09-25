// Import Internal Dependencies
import type { VoxelWorld } from "../../world/VoxelWorld.ts";
import type { VoxelLayer } from "../../world/VoxelLayer.ts";
import type { BlockVariantCache } from "../variants/BlockVariantCache.ts";
import { LayerChunkCache } from "./LayerChunkCache.ts";
import {
  FACE_AXIS,
  FACE_OFFSETS,
  FACE_OPPOSITE
} from "../../utils/math.ts";
import {
  AO_UNOCCLUDED,
  aoCornerLevel,
  aoUAxis,
  aoVAxis,
  packAoCorners
} from "../ambientOcclusion.ts";
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
      if (!candidate.effectivelyVisible) {
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
    variant: BlockVariant,
    face: BlockVariantFace
  ): boolean {
    if (!this.#selfOpaque) {
      const cache = this.#self;

      return cache !== null &&
        this.#occludes(cache.packedAt(nx, ny, nz), variant, face);
    }

    const layers = this.layers;

    for (let i = 0; i < this.#layerCount; i++) {
      const cache = layers[i];
      if (!cache.opaque) {
        continue;
      }

      const neighbour = cache.packedAt(nx, ny, nz);
      if (neighbour !== VOXEL_ABSENT) {
        if (this.#occludes(neighbour, variant, face)) {
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

  ambientOcclusionAt(
    direction: number,
    wx: number,
    wy: number,
    wz: number
  ): number {
    if (direction < 0) {
      return AO_UNOCCLUDED;
    }

    const axis = FACE_AXIS[direction];
    const offset = FACE_OFFSETS[direction];
    const uAxis = aoUAxis(axis);
    const vAxis = aoVAxis(axis);
    const x = wx + offset[0];
    const y = wy + offset[1];
    const z = wz + offset[2];
    const ux = uAxis === 0 ? 1 : 0;
    const uy = uAxis === 1 ? 1 : 0;
    const vy = vAxis === 1 ? 1 : 0;
    const vz = vAxis === 2 ? 1 : 0;

    const uMin = this.#occluderAt(x - ux, y - uy, z);
    const uMax = this.#occluderAt(x + ux, y + uy, z);
    const vMin = this.#occluderAt(x, y - vy, z - vz);
    const vMax = this.#occluderAt(x, y + vy, z + vz);

    return packAoCorners(
      aoCornerLevel(
        uMin,
        vMin,
        this.#occluderAt(x - ux, y - uy - vy, z - vz)
      ),
      aoCornerLevel(
        uMax,
        vMin,
        this.#occluderAt(x + ux, y + uy - vy, z - vz)
      ),
      aoCornerLevel(
        uMin,
        vMax,
        this.#occluderAt(x - ux, y - uy + vy, z + vz)
      ),
      aoCornerLevel(
        uMax,
        vMax,
        this.#occluderAt(x + ux, y + uy + vy, z + vz)
      )
    );
  }

  #occluderAt(
    wx: number,
    wy: number,
    wz: number
  ): boolean {
    if (!this.#selfOpaque) {
      const cache = this.#self;

      return cache !== null && this.#castsOcclusion(cache.packedAt(wx, wy, wz));
    }

    const layers = this.layers;
    for (let i = 0; i < this.#layerCount; i++) {
      const cache = layers[i];
      if (!cache.opaque) {
        continue;
      }

      const packed = cache.packedAt(wx, wy, wz);
      if (packed === VOXEL_ABSENT) {
        continue;
      }
      if (this.#castsOcclusion(packed)) {
        return true;
      }
      if (cache.layer.compositing === "replace") {
        return false;
      }
    }

    return false;
  }

  #castsOcclusion(
    packed: PackedVoxel
  ): boolean {
    return packed !== VOXEL_ABSENT &&
      this.#variants.occlusionMaskOf(
        voxelBlockId(packed),
        voxelTransform(packed)
      ) !== 0;
  }

  #occludes(
    neighbour: PackedVoxel,
    variant: BlockVariant,
    face: BlockVariantFace
  ): boolean {
    if (neighbour === VOXEL_ABSENT) {
      return false;
    }

    const neighbourBlockId = voxelBlockId(neighbour);
    const transform = voxelTransform(neighbour);

    const sameBlock = neighbourBlockId === variant.blockId;
    if (
      variant.keepsCoveredFaces &&
      (sameBlock || variant.surface.side === "double")
    ) {
      return false;
    }

    const mask = sameBlock ?
      this.#variants.selfOcclusionMaskOf(neighbourBlockId, transform) :
      this.#variants.occlusionMaskOf(neighbourBlockId, transform);
    if ((mask & (1 << FACE_OPPOSITE[face.cull])) !== 0) {
      return true;
    }
    if (face.full || face.splittable) {
      return false;
    }

    const neighbourVariant = this.#variants.get(neighbourBlockId, transform);

    return neighbourVariant !== null &&
      (sameBlock || neighbourVariant.surface.occludes) &&
      this.#variants.isFaceCoveredBy(face, neighbourVariant);
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
