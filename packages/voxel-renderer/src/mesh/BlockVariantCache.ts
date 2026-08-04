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
/** Occlusion table slot holding no compiled mask yet. */
const kOcclusionUnknown = -1;
/**
 * Ceiling on the flat occlusion table, in slots. 64k slots (256 KB) covers
 * block ids 0-2047; ids above that fall back to the variant map, which is
 * simply the behaviour before the table existed.
 */
const kOcclusionMaxSlots = 1 << 16;

/**
 * How a mergeable face maps onto the world axes so the greedy mesher can
 * stretch it over a run of identical voxels.
 *
 * Only full unit quads on a block boundary can be stretched; `BlockVariantCache`
 * computes this once per (block, transform).
 */
export interface BlockFaceMerge {
  /** World axis the face is perpendicular to (0 = x, 1 = y, 2 = z). */
  axis: number;
  /** The two in-plane world axes, ascending. */
  uAxis: number;
  vAxis: number;
  /**
   * True when the tile's U runs along `vAxis` instead of `uAxis` — a rotated
   * or mirrored block turns the tile sideways relative to the world axes.
   */
  swapped: boolean;
}

/**
 * One emitted polygon of a block variant, resolved at compile time.
 * Rotation, mirroring, atlas UVs and flip-Y winding are baked in, so emitting
 * it is a copy plus a translation by the voxel position.
 */
export interface BlockVariantFace {
  /** World-space neighbour direction to test for occlusion, or -1 to always emit. */
  cull: number;
  /** Index of the per-tileset geometry buffer this face belongs to. */
  slot: number;
  vertexCount: number;
  /** 3 indices per triangle: 6 for a quad, 3 otherwise. */
  indexCount: number;
  /** `vertexCount × 3` block-local positions in 0-1 space. */
  positions: Float32Array;
  /**
   * `vertexCount × 2` atlas UVs, already unsigned-normalized. Emitted verbatim
   * on the non-tiled path, so the mesher never re-quantises them.
   */
  uvs: Uint16Array;
  /**
   * `vertexCount × 2` UVs in tile space (0-1 inside the tile), before the atlas
   * rect is applied. Greedy meshing scales these past 1 to repeat the tile and
   * lets the shader fold them back into `region`, so they stay float.
   */
  tileUvs: Float32Array;
  /**
   * The tile's atlas rect `[offsetU, offsetV, scaleU, scaleV]`, unsigned
   * normalized like `uvs`.
   */
  region: Uint16Array;
  /** Non-null when the face can be stretched over a run of identical voxels. */
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
   * The mergeable face covering each world-space direction, indexed by `FACE`.
   * Undefined where the variant has no full-quad face pointing that way.
   */
  mergeFaces: readonly (BlockVariantFace | undefined)[];
  /**
   * Scratch slot owned by the single `GreedyMesher` sweeping this cache: the
   * variant's compact index in the chunk being meshed. Only meaningful while
   * `sweepEpoch` matches that mesher's current epoch.
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
 * Compiles and memoizes the geometry of a (blockId, transform) pair.
 *
 * This avoids recomputing per-vertex rotation, mirroring and atlas UV math for
 * every voxel in the world. Entries are dropped when block, shape or tileset
 * registries report a new version.
 */
export class BlockVariantCache {
  #blockRegistry: BlockRegistry;
  #shapeRegistry: BlockShapeRegistry;
  #tilesetManager: TilesetManager;

  #variants = new Map<number, BlockVariant | null>();
  /** Slot per `(tilesetId, cutout)`, and the two properties of each slot. */
  #slots = new Map<string, number>();
  #tilesetIds: string[] = [];
  #cutouts: boolean[] = [];

  /**
   * `occlusionMask` per (blockId, transform), `kOcclusionUnknown` where not yet
   * compiled. The mesh builder asks for this bitmask once per face test, so it
   * gets a flat array read instead of a hash lookup.
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

  /**
   * Drops every compiled variant when a registry has changed since the last
   * call. Cheap enough to run before each chunk.
   */
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
   * Returns null when the block or its shape is unknown. Such a voxel emits no
   * geometry and occludes nothing.
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
   * Bit `f` of the returned mask is set when the variant fully covers
   * world-space face `f`. Returns 0 for an unknown block, which occludes
   * nothing — same answer `get()` would produce, without the Map lookup or the
   * `BlockVariant` the caller does not need.
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

  /** True when the slot holds the faces of `transparent` blocks. */
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
        // No texture configured — the face is never emitted.
        continue;
      }

      // An explicit `cull` field overrides the default (which is to use
      // `face`); `null` means always emit.
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
      // A see-through block covers nothing, whatever its shape says.
      occlusionMask: cutout ? 0 : this.#occlusionMask(shape, rotation, flipY),
      mergeFaces: indexMergeFaces(faces),
      sweepIndex: 0,
      // No mesher epoch is ever negative, so a freshly compiled variant always
      // reads as "not yet seen in this chunk".
      sweepEpoch: -1
    };
  }

  /**
   * Bakes `shape.occludes()` for all six directions into a bitmask indexed by
   * *world* face. Each world face is converted to the variant's local space
   * with the INVERSE rotation (rotateFace maps local→world).
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
 * Picks, per world-space direction, the face the greedy mesher may stretch.
 *
 * A shape could in principle declare two full quads pointing the same way (two
 * coplanar halves, say); only the first is kept mergeable and the others fall
 * back to the per-voxel path, which keeps `merge !== null` a reliable "the
 * sweep owns this face" test.
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
 * Describes how a face maps onto the world axes, or null when it cannot be
 * stretched over a run of voxels.
 *
 * A face qualifies only when it is a quad whose four corners match the block
 * boundary and the tile corners. Slopes, triangles and inset faces fail and
 * keep the per-voxel path.
 */
function describeMerge(
  cull: number,
  positions: Float32Array,
  tileUvs: Float32Array
): BlockFaceMerge | null {
  // `positions` is allocated as `vertexCount * 3`, so its length carries the
  // vertex count already.
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
