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
  decodeAoCorners,
  aoUAxis,
  aoVAxis
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

// CONSTANTS
const kOccluderUnknown = -1;

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
  allocateVoxelWindow?: (index: number) => Int32Array | null;
  /**
   * Reusable `(chunkSize + 4)³` scratch memoizing ambient occlusion
   * samples, or null to resolve each sample again. Its previous content is
   * discarded.
   */
  occluders?: Int8Array | null;
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
  #occluders: Int8Array | null = null;
  #occluderSpan = 0;
  #occluderMinX = 0;
  #occluderMinY = 0;
  #occluderMinZ = 0;

  constructor(
    options: ChunkNeighbourhoodOptions
  ) {
    const {
      world,
      variants,
      minWx,
      minWy,
      minWz,
      allocateVoxelWindow,
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
        window: allocateVoxelWindow?.(layers.length) ?? null
      });
      if (!cache.empty) {
        layers.push(cache);
      }
    }

    this.layers = layers;
    this.#variants = variants;
    this.#layerCount = layers.length;

    const { occluders = null } = options;
    const span = chunkSize + 4;
    if (occluders !== null && occluders.length >= span * span * span) {
      occluders.fill(kOccluderUnknown, 0, span * span * span);
      this.#occluders = occluders;
      this.#occluderSpan = span;
      this.#occluderMinX = minWx - 1;
      this.#occluderMinY = minWy - 1;
      this.#occluderMinZ = minWz - 1;
    }
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

    const occluders = this.#occluders;
    const span = this.#occluderSpan;
    const cx = x - this.#occluderMinX;
    const cy = y - this.#occluderMinY;
    const cz = z - this.#occluderMinZ;
    if (
      occluders === null ||
      cx < 1 || cy < 1 || cz < 1 ||
      cx >= span - 1 || cy >= span - 1 || cz >= span - 1
    ) {
      return decodeAoCorners(
        this.#occluderAt(x - ux, y - uy, z) |
        (this.#occluderAt(x + ux, y + uy, z) << 1) |
        (this.#occluderAt(x, y - vy, z - vz) << 2) |
        (this.#occluderAt(x, y + vy, z + vz) << 3) |
        (this.#occluderAt(x - ux, y - uy - vy, z - vz) << 4) |
        (this.#occluderAt(x + ux, y + uy - vy, z - vz) << 5) |
        (this.#occluderAt(x - ux, y - uy + vy, z + vz) << 6) |
        (this.#occluderAt(x + ux, y + uy + vy, z + vz) << 7)
      );
    }

    const centre = cx + (span * (cy + (span * cz)));
    const du = ux + (uy * span);
    const dv = (vy + (vz * span)) * span;

    return decodeAoCorners(
      this.#memoizedOccluderAt(centre - du, x - ux, y - uy, z) |
      (this.#memoizedOccluderAt(centre + du, x + ux, y + uy, z) << 1) |
      (this.#memoizedOccluderAt(centre - dv, x, y - vy, z - vz) << 2) |
      (this.#memoizedOccluderAt(centre + dv, x, y + vy, z + vz) << 3) |
      (this.#memoizedOccluderAt(
        centre - du - dv,
        x - ux,
        y - uy - vy,
        z - vz
      ) << 4) |
      (this.#memoizedOccluderAt(
        centre + du - dv,
        x + ux,
        y + uy - vy,
        z - vz
      ) << 5) |
      (this.#memoizedOccluderAt(
        centre - du + dv,
        x - ux,
        y - uy + vy,
        z + vz
      ) << 6) |
      (this.#memoizedOccluderAt(
        centre + du + dv,
        x + ux,
        y + uy + vy,
        z + vz
      ) << 7)
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

      const neighbour = this.#blendNeighbourAt(cell, face, variant.blockId, group);
      out[i] = neighbour;
      found ||= neighbour !== null;
    }

    return found;
  }

  // eslint-disable-next-line max-params
  #blendNeighbourAt(
    cell: readonly [number, number, number],
    face: BlockVariantFace,
    blockId: number,
    group: BlendGroup
  ): FaceBlendNeighbour | null {
    const neighbour = this.#foreignVariantAt(cell[0], cell[1], cell[2], blockId);
    if (
      neighbour === null ||
      neighbour.blend === null ||
      neighbour.blend === group
    ) {
      return null;
    }

    const match = this.#variants.resolveBlendMatch(face, group, neighbour);
    if (match === null) {
      return null;
    }

    const offset = FACE_OFFSETS[face.cull];
    const covered = this.isNeighbourFaceHidden(
      cell[0] + offset[0],
      cell[1] + offset[1],
      cell[2] + offset[2],
      neighbour,
      match.face
    );

    return covered ? null : match.neighbour;
  }

  // eslint-disable-next-line max-params
  #foreignVariantAt(
    wx: number,
    wy: number,
    wz: number,
    ownBlockId: number
  ): BlockVariant | null {
    const layers = this.layers;
    for (let i = 0; i < this.#layerCount; i++) {
      const packed = layers[i].packedAt(wx, wy, wz);
      if (packed === VOXEL_ABSENT) {
        continue;
      }

      return !isMergedVoxel(packed) && voxelBlockId(packed) === ownBlockId ?
        null :
        this.#resolveVariant(layers[i], packed, wx, wy, wz);
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

    return packed === VOXEL_ABSENT ?
      null :
      this.#resolveVariant(cache, packed, wx, wy, wz);
  }

  // eslint-disable-next-line max-params
  #resolveVariant(
    cache: LayerChunkCache,
    packed: PackedVoxel,
    wx: number,
    wy: number,
    wz: number
  ): BlockVariant | null {
    if (!isMergedVoxel(packed)) {
      return this.#variants.get(voxelBlockId(packed), voxelTransform(packed));
    }

    const merged = this.#variants.resolveMerged(
      packed,
      cache.partnerAt(wx, wy, wz)
    );

    return merged?.occluder ?? null;
  }

  #occluderAt(
    wx: number,
    wy: number,
    wz: number
  ): number {
    const span = this.#occluderSpan;
    const x = wx - this.#occluderMinX;
    const y = wy - this.#occluderMinY;
    const z = wz - this.#occluderMinZ;
    if (
      this.#occluders === null ||
      (x | y | z) < 0 || x >= span || y >= span || z >= span
    ) {
      return Number(this.#resolveOccluderAt(wx, wy, wz));
    }

    return this.#memoizedOccluderAt(
      x + (span * (y + (span * z))),
      wx,
      wy,
      wz
    );
  }

  // eslint-disable-next-line max-params
  #memoizedOccluderAt(
    index: number,
    wx: number,
    wy: number,
    wz: number
  ): number {
    const occluders = this.#occluders;
    if (occluders === null) {
      return Number(this.#resolveOccluderAt(wx, wy, wz));
    }

    const known = occluders[index];
    if (known !== kOccluderUnknown) {
      return known;
    }

    const occluder = Number(this.#resolveOccluderAt(wx, wy, wz));
    occluders[index] = occluder;

    return occluder;
  }

  #resolveOccluderAt(
    wx: number,
    wy: number,
    wz: number
  ): boolean {
    const layers = this.layers;
    for (let i = 0; i < this.#layerCount; i++) {
      const cache = layers[i];
      const packed = cache.packedAt(wx, wy, wz);
      if (packed === VOXEL_ABSENT) {
        continue;
      }
      if (this.#resolveOcclusionMask(cache, packed, wx, wy, wz) !== 0) {
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

    return packed === VOXEL_ABSENT ?
      0 :
      this.#resolveOcclusionMask(cache, packed, wx, wy, wz);
  }

  // eslint-disable-next-line max-params
  #resolveOcclusionMask(
    cache: LayerChunkCache,
    packed: PackedVoxel,
    wx: number,
    wy: number,
    wz: number
  ): number {
    return isMergedVoxel(packed) ?
      this.#resolveVariant(cache, packed, wx, wy, wz)?.occlusionMask ?? 0 :
      this.#variants.resolveOcclusionMask(
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
      this.#variants.resolveSelfOcclusionMask(blockId, transform) :
      this.#variants.resolveOcclusionMask(blockId, transform);

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
      return remove ? [] : [this.#variants.resolveFrontFace(face)];
    }

    return splitBoundaryFace({
      face,
      neighbour,
      frontSlot: this.#variants.resolveFrontSlot(face.slot),
      remove
    });
  }
}
