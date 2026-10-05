// Import Internal Dependencies
import {
  AUTHORED_LAYER_VISIBILITY,
  type MeshableLayer,
  type MeshableLayerVisibility,
  type MeshableWorld
} from "../types.ts";
import type { BlockVariantCache } from "../variants/BlockVariantCache.ts";
import { LayerChunkCache } from "./LayerChunkCache.ts";
import {
  FACE_AXIS,
  FACE_OFFSETS,
  FACE_OPPOSITE
} from "../../../document/geometry/faceDirection.ts";
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
  blendsFace,
  FACE_BLEND_OFFSETS,
  type FaceBlendNeighbour,
  type FaceBlendNeighbours
} from "../faceBlend.ts";
import type { BlendGroup } from "../../../document/materials/BlendGroup.ts";
import {
  voxelBlockId,
  voxelTransform,
  VOXEL_ABSENT,
  type PackedVoxel
} from "../../../document/world/storage/packedVoxel.ts";
import { isMergedVoxel } from "../../../document/world/storage/mergedVoxel.ts";

export interface ChunkNeighbourhoodOptions {
  world: MeshableWorld;
  variants: BlockVariantCache;
  minWx: number;
  minWy: number;
  minWz: number;
  /**
   * Supplies the reusable lookup window of the n-th non-empty layer, or null
   * to query chunk storage directly.
   */
  windowFor?: (index: number) => Int32Array | null;
  visibility?: MeshableLayerVisibility;
}

/**
 * Provides compositing and occlusion queries over visible layers.
 */
export class ChunkNeighbourhood {
  readonly layers: readonly LayerChunkCache[];

  #variants: BlockVariantCache;
  #layerCount: number;
  #selfLayer: MeshableLayer | null = null;
  #selfIndex = -1;
  #self: LayerChunkCache | null = null;
  #blendCell: [number, number, number] = [0, 0, 0];

  constructor(
    options: ChunkNeighbourhoodOptions
  ) {
    const {
      world,
      variants,
      minWx,
      minWy,
      minWz,
      windowFor,
      visibility = AUTHORED_LAYER_VISIBILITY
    } = options;
    const layers: LayerChunkCache[] = [];
    const { chunkSize } = world;

    for (const candidate of world.getLayers()) {
      if (!visibility.isVisible(candidate)) {
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
    this.#variants = variants;
    this.#layerCount = layers.length;
  }

  get self(): MeshableLayer | null {
    return this.#selfLayer;
  }

  set self(
    layer: MeshableLayer
  ) {
    this.#selfLayer = layer;
    this.#selfIndex = this.layers.findIndex(
      (cache) => cache.layer === layer
    );
    this.#self = this.layers[this.#selfIndex] ?? null;
  }

  winsCompositing(
    wx: number,
    wy: number,
    wz: number
  ): boolean {
    const layers = this.layers;
    const selfIndex = this.#selfIndex;

    for (let i = 0; i < this.#layerCount; i++) {
      if (i === selfIndex) {
        return true;
      }

      const packed = layers[i].packedAt(wx, wy, wz);
      if (packed !== VOXEL_ABSENT && (
        layers[i].layer.compositing === "replace" ||
        this.#occlusionMaskAt(layers[i], wx, wy, wz) === 0b111111
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
    const layers = this.layers;

    for (let i = 0; i < this.#layerCount; i++) {
      const cache = layers[i];
      const neighbour = cache.packedAt(nx, ny, nz);
      if (neighbour !== VOXEL_ABSENT) {
        const hidden = isMergedVoxel(neighbour) ?
          this.#occludedBy(this.#variantAt(cache, nx, ny, nz), variant, face) :
          this.#occludes(neighbour, variant, face);
        if (hidden) {
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

  /**
   * Fills `out` with the blend neighbour of each `FACE_BLEND_OFFSETS` cell,
   * or null. A neighbour blends when its group bleeds onto this face's
   * group, its matching face shares this face's atlas and is not covered.
   * Returns false, leaving `out` untouched, when the face cannot blend.
   */
  blendNeighboursAt(
    variant: BlockVariant,
    face: BlockVariantFace,
    position: readonly [wx: number, wy: number, wz: number],
    out: FaceBlendNeighbours
  ): boolean {
    const group = variant.blend;
    if (group === null || !blendsFace(face)) {
      return false;
    }

    const axis = FACE_AXIS[face.cull];
    const uAxis = aoUAxis(axis);
    const vAxis = aoVAxis(axis);
    const cell = this.#blendCell;
    let found = false;
    for (let i = 0; i < FACE_BLEND_OFFSETS.length; i++) {
      const [du, dv] = FACE_BLEND_OFFSETS[i];
      cell[0] = position[0];
      cell[1] = position[1];
      cell[2] = position[2];
      cell[uAxis] += du;
      cell[vAxis] += dv;

      const neighbour = this.#blendNeighbourAt(cell, face, group);
      out[i] = neighbour;
      found ||= neighbour !== null;
    }

    return found;
  }

  #blendNeighbourAt(
    cell: readonly [number, number, number],
    face: BlockVariantFace,
    group: BlendGroup
  ): FaceBlendNeighbour | null {
    const neighbour = this.#visibleVariantAt(cell[0], cell[1], cell[2]);
    if (neighbour === null || neighbour.blend === null) {
      return null;
    }

    const strength = neighbour.blend.bleedOnto(group);
    if (strength === 0) {
      return null;
    }

    const { tilesetId } = this.#variants.geometryKeyAt(face.slot);
    const matching = neighbour.faces.find((candidate) => (
      candidate.cull === face.cull &&
      this.#variants.geometryKeyAt(candidate.slot).tilesetId === tilesetId
    ));
    if (matching === undefined) {
      return null;
    }

    const offset = FACE_OFFSETS[face.cull];
    const covered = this.isNeighbourFaceHidden(
      cell[0] + offset[0],
      cell[1] + offset[1],
      cell[2] + offset[2],
      neighbour,
      matching
    );

    return covered ? null : {
      region: matching.region,
      group: neighbour.blend,
      strength,
      inverted: strength < 1 && neighbour.blend.id > group.id
    };
  }

  #visibleVariantAt(
    wx: number,
    wy: number,
    wz: number
  ): BlockVariant | null {
    const layers = this.layers;
    for (let i = 0; i < this.#layerCount; i++) {
      if (layers[i].packedAt(wx, wy, wz) !== VOXEL_ABSENT) {
        return this.#variantAt(layers[i], wx, wy, wz);
      }
    }

    return null;
  }

  #variantAt(
    cache: LayerChunkCache,
    wx: number,
    wy: number,
    wz: number
  ): BlockVariant | null {
    const packed = cache.packedAt(wx, wy, wz);
    if (packed === VOXEL_ABSENT) {
      return null;
    }

    if (!isMergedVoxel(packed)) {
      return this.#variants.get(voxelBlockId(packed), voxelTransform(packed));
    }

    const merged = this.#variants.mergedOf(
      packed,
      cache.partnerAt(wx, wy, wz)
    );

    return merged?.occluder ?? null;
  }

  #occluderAt(
    wx: number,
    wy: number,
    wz: number
  ): boolean {
    const layers = this.layers;
    for (let i = 0; i < this.#layerCount; i++) {
      const cache = layers[i];
      if (cache.packedAt(wx, wy, wz) === VOXEL_ABSENT) {
        continue;
      }
      if (this.#occlusionMaskAt(cache, wx, wy, wz) !== 0) {
        return true;
      }
      if (cache.layer.compositing === "replace") {
        return false;
      }
    }

    return false;
  }

  #occlusionMaskAt(
    cache: LayerChunkCache,
    wx: number,
    wy: number,
    wz: number
  ): number {
    const packed = cache.packedAt(wx, wy, wz);
    if (packed === VOXEL_ABSENT) {
      return 0;
    }

    return isMergedVoxel(packed) ?
      this.#variantAt(cache, wx, wy, wz)?.occlusionMask ?? 0 :
      this.#variants.occlusionMaskOf(
        voxelBlockId(packed),
        voxelTransform(packed)
      );
  }

  #occludes(
    neighbour: PackedVoxel,
    variant: BlockVariant,
    face: BlockVariantFace
  ): boolean {
    const blockId = voxelBlockId(neighbour);
    const transform = voxelTransform(neighbour);
    const sameBlock = blockId === variant.blockId;
    const mask = sameBlock ?
      this.#variants.selfOcclusionMaskOf(blockId, transform) :
      this.#variants.occlusionMaskOf(blockId, transform);

    return this.#hiddenByMask(mask, sameBlock, variant, face) ??
      this.#coveredBy(this.#variants.get(blockId, transform), sameBlock, face);
  }

  #occludedBy(
    neighbour: BlockVariant | null,
    variant: BlockVariant,
    face: BlockVariantFace
  ): boolean {
    if (neighbour === null) {
      return false;
    }

    const sameBlock = neighbour.blockId === variant.blockId;
    const mask = sameBlock ?
      neighbour.selfOcclusionMask :
      neighbour.occlusionMask;

    return this.#hiddenByMask(mask, sameBlock, variant, face) ??
      this.#coveredBy(neighbour, sameBlock, face);
  }

  #hiddenByMask(
    mask: number,
    sameBlock: boolean,
    variant: BlockVariant,
    face: BlockVariantFace
  ): boolean | null {
    if (
      variant.keepsCoveredFaces &&
      (sameBlock || variant.surface.side === "double")
    ) {
      return false;
    }
    if ((mask & (1 << FACE_OPPOSITE[face.cull])) !== 0) {
      return true;
    }

    return face.full || face.splittable ? false : null;
  }

  #coveredBy(
    neighbour: BlockVariant | null,
    sameBlock: boolean,
    face: BlockVariantFace
  ): boolean {
    return neighbour !== null &&
      (sameBlock || neighbour.surface.occludes) &&
      this.#variants.isFaceCoveredBy(face, neighbour);
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
      const neighbour = this.#variantAt(
        cache,
        wx + offset[0],
        wy + offset[1],
        wz + offset[2]
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
      if (cache.layer.compositing === "replace") {
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
