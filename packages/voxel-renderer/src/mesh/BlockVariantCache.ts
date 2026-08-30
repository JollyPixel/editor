// Import Internal Dependencies
import type { BlockRegistry } from "../blocks/BlockRegistry.ts";
import type { BlockShape } from "../blocks/BlockShape.ts";
import type { BlockShapeRegistry } from "../blocks/BlockShapeRegistry.ts";
import type { TilesetManager } from "../tileset/TilesetManager.ts";
import { chunkGeometryKey } from "./chunkGeometryKey.ts";
import { FACE } from "../utils/math.ts";
import {
  rotateFace,
  rotateVertex,
  rotateNormal,
  flipYFace
} from "./rotation.ts";
import {
  toSnorm8,
  toUnorm16
} from "./quantize.ts";

// CONSTANTS
// A packed transform uses bits 0-4, so a block has at most 32 variants.
const kTransformCount = 32;
const kTransformMask = kTransformCount - 1;
const kAllFaces: readonly FACE[] = [
  FACE.PosX,
  FACE.NegX,
  FACE.PosY,
  FACE.NegY,
  FACE.PosZ,
  FACE.NegZ
];
const kOcclusionUnknown = -1;
/**
 * Caps the flat occlusion table at 64k slots; higher IDs use the map.
 */
const kOcclusionMaxSlots = 1 << 16;

/**
 * World-axis mapping for a full quad that greedy meshing can stretch.
 */
export interface BlockFaceMerge {
  /** World axis the face is perpendicular to (0 = x, 1 = y, 2 = z). */
  axis: number;
  uAxis: number;
  vAxis: number;
  /**
   * True when tile U follows `vAxis` after rotation or mirroring.
   */
  swapped: boolean;
}

/**
 * Polygon with transforms, winding, and atlas UVs compiled into its data.
 */
export interface BlockVariantFace {
  /** World-space neighbour direction to test for occlusion, or -1 to always emit. */
  cull: number;
  slot: number;
  vertexCount: number;
  indexCount: number;
  /** `vertexCount × 3` block-local positions in 0-1 space. */
  positions: Float32Array;
  /**
   * Unsigned-normalized atlas UVs emitted by the non-tiled path.
   */
  uvs: Uint16Array;
  /**
   * Float tile-space UVs that greedy quads scale beyond 1 for repetition.
   */
  tileUvs: Float32Array;
  /**
   * Unsigned-normalized `[offsetU, offsetV, scaleU, scaleV]` atlas rect.
   */
  region: Uint16Array;
  merge: BlockFaceMerge | null;
  /** Face normal, signed-normalized to the byte the attribute is emitted as. */
  normalX: number;
  normalY: number;
  normalZ: number;
}

export interface BlockVariant {
  faces: readonly BlockVariantFace[];
  /** Bit `f` is set when this variant fully covers world-space face `f`. */
  occlusionMask: number;
  /**
   * Mergeable full-quad face for each world-space direction.
   */
  mergeFaces: readonly (BlockVariantFace | undefined)[];
  /**
   * Per-mesher scratch index valid only while `sweepEpoch` matches.
   */
  sweepIndex: number;
  sweepEpoch: number;
}

export interface BlockVariantCacheOptions {
  blockRegistry: BlockRegistry;
  shapeRegistry: BlockShapeRegistry;
  tilesetManager: TilesetManager;
}

/**
 * Memoizes transformed geometry and atlas UVs by block and transform.
 */
export class BlockVariantCache {
  #blockRegistry: BlockRegistry;
  #shapeRegistry: BlockShapeRegistry;
  #tilesetManager: TilesetManager;

  #variants = new Map<number, BlockVariant | null>();
  #slots = new Map<string, number>();
  #tilesetIds: string[] = [];
  #cutouts: boolean[] = [];

  /**
   * Flat occlusion cache indexed by block and transform.
   */
  #occlusion = new Int32Array(0);

  #blockVersion = -1;
  #shapeVersion = -1;
  #tilesetVersion = -1;

  constructor(
    options: BlockVariantCacheOptions
  ) {
    this.#blockRegistry = options.blockRegistry;
    this.#shapeRegistry = options.shapeRegistry;
    this.#tilesetManager = options.tilesetManager;
  }

  refresh(): void {
    const blockVersion = this.#blockRegistry.version;
    const shapeVersion = this.#shapeRegistry.version;
    const tilesetVersion = this.#tilesetManager.version;

    if (
      blockVersion === this.#blockVersion &&
      shapeVersion === this.#shapeVersion &&
      tilesetVersion === this.#tilesetVersion
    ) {
      return;
    }

    this.#blockVersion = blockVersion;
    this.#shapeVersion = shapeVersion;
    this.#tilesetVersion = tilesetVersion;
    this.#variants.clear();
    this.#occlusion.fill(kOcclusionUnknown);
  }

  /**
   * Returns null when the block or shape is unknown.
   */
  get(
    blockId: number,
    transform: number
  ): BlockVariant | null {
    const key = (blockId * kTransformCount) + (transform & kTransformMask);

    let variant = this.#variants.get(key);
    if (variant === undefined) {
      variant = this.#compile(blockId, transform & kTransformMask);
      this.#variants.set(key, variant);
    }

    return variant;
  }

  /**
   * Returns a world-face occlusion mask, or 0 for an unknown block.
   */
  occlusionMaskOf(
    blockId: number,
    transform: number
  ): number {
    const key = (blockId * kTransformCount) + (transform & kTransformMask);
    // Unsigned so a negative key (never produced by a packed voxel, but cheap
    // to rule out) misses the table instead of reading `undefined`.
    if (key >>> 0 < this.#occlusion.length) {
      const cached = this.#occlusion[key];
      if (cached !== kOcclusionUnknown) {
        return cached;
      }
    }

    return this.#compileOcclusion(key, blockId, transform);
  }

  #compileOcclusion(
    key: number,
    blockId: number,
    transform: number
  ): number {
    const variant = this.get(blockId, transform);
    const mask = variant === null ? 0 : variant.occlusionMask;

    if (key >= 0 && key < kOcclusionMaxSlots) {
      if (key >= this.#occlusion.length) {
        const grown = new Int32Array(
          Math.min(kOcclusionMaxSlots, nextPowerOfTwo(key + 1))
        ).fill(kOcclusionUnknown);
        grown.set(this.#occlusion);
        this.#occlusion = grown;
      }
      this.#occlusion[key] = mask;
    }

    return mask;
  }

  tilesetIdAt(
    slot: number
  ): string {
    return this.#tilesetIds[slot];
  }

  isCutoutAt(
    slot: number
  ): boolean {
    return this.#cutouts[slot];
  }

  #slotFor(
    tilesetId: string,
    cutout: boolean
  ): number {
    const key = chunkGeometryKey(tilesetId, cutout);

    let slot = this.#slots.get(key);
    if (slot === undefined) {
      slot = this.#tilesetIds.length;
      this.#tilesetIds.push(tilesetId);
      this.#cutouts.push(cutout);
      this.#slots.set(key, slot);
    }

    return slot;
  }

  #compile(
    blockId: number,
    transform: number
  ): BlockVariant | null {
    const blockDef = this.#blockRegistry.get(blockId);
    if (!blockDef) {
      return null;
    }

    const shape = this.#shapeRegistry.get(blockDef.shapeId);
    if (!shape) {
      return null;
    }

    const cutout = blockDef.transparent === true;
    const rotation = transform & 0b11;
    const flipX = (transform & 0b100) !== 0;
    const flipZ = (transform & 0b1000) !== 0;
    const flipY = (transform & 0b10000) !== 0;

    const faces: BlockVariantFace[] = [];
    for (const faceDef of shape.faces) {
      const tileRef = blockDef.faceTextures[faceDef.face] ?? blockDef.defaultTexture;
      if (!tileRef) {
        continue;
      }

      const cullFace = faceDef.cull === undefined ? faceDef.face : faceDef.cull;
      let cull = -1;
      if (cullFace !== null) {
        const worldFace = rotateFace(cullFace, rotation);
        cull = flipY ? flipYFace(worldFace) : worldFace;
      }

      const uvRegion = this.#tilesetManager.getTileUV(tileRef);
      const vertexCount = faceDef.vertices.length;
      const positions = new Float32Array(vertexCount * 3);
      const uvs = new Uint16Array(vertexCount * 2);
      const tileUvs = new Float32Array(vertexCount * 2);

      for (let i = 0; i < vertexCount; i++) {
        // flipY mirrors the face, so vertices are stored in reverse order to
        // keep the winding (and therefore the front side) correct.
        const vi = flipY ? vertexCount - 1 - i : i;
        const vertex = rotateVertex(
          faceDef.vertices[vi],
          rotation,
          { x: flipX, z: flipZ, y: flipY }
        );
        positions[i * 3] = vertex[0];
        positions[(i * 3) + 1] = vertex[1];
        positions[(i * 3) + 2] = vertex[2];

        const tileUV = faceDef.uvs[vi];
        tileUvs[i * 2] = tileUV[0];
        tileUvs[(i * 2) + 1] = tileUV[1];
        // `fround` reproduces the float32 staging buffer these used to pass
        // through, so the quantised result is unchanged.
        uvs[i * 2] = toUnorm16(
          Math.fround(uvRegion.offsetU + (uvRegion.scaleU * tileUV[0]))
        );
        uvs[(i * 2) + 1] = toUnorm16(
          Math.fround(uvRegion.offsetV + (uvRegion.scaleV * tileUV[1]))
        );
      }

      const normal = rotateNormal(
        faceDef.normal,
        rotation,
        { flipX, flipZ, flipY }
      );

      faces.push({
        cull,
        slot: this.#slotFor(
          tileRef.tilesetId ?? this.#tilesetManager.defaultTilesetId!,
          cutout
        ),
        vertexCount,
        indexCount: vertexCount === 4 ? 6 : 3,
        positions,
        uvs,
        tileUvs,
        region: new Uint16Array([
          toUnorm16(Math.fround(uvRegion.offsetU)),
          toUnorm16(Math.fround(uvRegion.offsetV)),
          toUnorm16(Math.fround(uvRegion.scaleU)),
          toUnorm16(Math.fround(uvRegion.scaleV))
        ]),
        merge: describeMerge(cull, positions, tileUvs),
        normalX: toSnorm8(normal[0]),
        normalY: toSnorm8(normal[1]),
        normalZ: toSnorm8(normal[2])
      });
    }

    return {
      faces,
      occlusionMask: cutout ? 0 : this.#occlusionMask(shape, rotation, flipY),
      mergeFaces: indexMergeFaces(faces),
      sweepIndex: 0,
      // No mesher epoch is ever negative, so a freshly compiled variant always
      // reads as "not yet seen in this chunk".
      sweepEpoch: -1
    };
  }

  /**
   * Bakes local occlusion into a world-face bitmask.
   */
  #occlusionMask(
    shape: BlockShape,
    rotation: number,
    flipY: boolean
  ): number {
    const inverse = (4 - rotation) % 4;

    let mask = 0;
    for (const worldFace of kAllFaces) {
      const rotated = rotateFace(worldFace, inverse);
      const localFace = flipY ? flipYFace(rotated) : rotated;

      if (shape.occludes(localFace)) {
        mask |= 1 << worldFace;
      }
    }

    return mask;
  }
}

/**
 * Selects at most one stretchable face per world-space direction.
 */
function indexMergeFaces(
  faces: BlockVariantFace[]
): (BlockVariantFace | undefined)[] {
  const mergeFaces = new Array<BlockVariantFace | undefined>(6).fill(undefined);

  for (const face of faces) {
    if (face.merge === null) {
      continue;
    }

    if (mergeFaces[face.cull] === undefined) {
      mergeFaces[face.cull] = face;
    }
    else {
      face.merge = null;
    }
  }

  return mergeFaces;
}

/**
 * Maps a full boundary quad onto world axes, or rejects it as unmergeable.
 */
function describeMerge(
  cull: number,
  positions: Float32Array,
  tileUvs: Float32Array
): BlockFaceMerge | null {
  if (positions.length !== 12 || cull < 0) {
    return null;
  }

  // FACE packs direction as `axis * 2 + (negative ? 1 : 0)`.
  const axis = cull >> 1;
  const plane = (cull & 1) === 0 ? 1 : 0;
  const uAxis = axis === 0 ? 1 : 0;
  const vAxis = axis === 2 ? 1 : 2;

  // Bit `(v << 1) | u` per visited corner; all four must show up exactly once
  // in both position and tile space.
  let cornerMask = 0;
  let uvMask = 0;

  for (let i = 0; i < 4; i++) {
    if (positions[(i * 3) + axis] !== plane) {
      return null;
    }

    const pu = positions[(i * 3) + uAxis];
    const pv = positions[(i * 3) + vAxis];
    const tu = tileUvs[i * 2];
    const tv = tileUvs[(i * 2) + 1];
    if (!isCorner(pu) || !isCorner(pv) || !isCorner(tu) || !isCorner(tv)) {
      return null;
    }

    cornerMask |= 1 << ((pv << 1) | pu);
    uvMask |= 1 << ((tv << 1) | tu);
  }

  if (cornerMask !== 0b1111 || uvMask !== 0b1111) {
    return null;
  }

  // Walk from corner 0 to the corner reached by moving along uAxis alone: the
  // tile coordinate that changes there is the one that follows uAxis.
  for (let i = 1; i < 4; i++) {
    if (
      positions[(i * 3) + vAxis] === positions[vAxis] &&
      positions[(i * 3) + uAxis] !== positions[uAxis]
    ) {
      return {
        axis,
        uAxis,
        vAxis,
        swapped: tileUvs[i * 2] === tileUvs[0]
      };
    }
  }

  return null;
}

function isCorner(
  value: number
): boolean {
  return value === 0 || value === 1;
}

function nextPowerOfTwo(
  value: number
): number {
  return 2 ** Math.ceil(Math.log2(value));
}
