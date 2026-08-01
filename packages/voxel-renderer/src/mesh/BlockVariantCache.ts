// Import Internal Dependencies
import type { BlockRegistry } from "../blocks/BlockRegistry.ts";
import type { BlockShape } from "../blocks/BlockShape.ts";
import type { BlockShapeRegistry } from "../blocks/BlockShapeRegistry.ts";
import type { TilesetManager } from "../tileset/TilesetManager.ts";
import { FACE } from "../utils/math.ts";
import {
  rotateFace,
  rotateVertex,
  rotateNormal,
  flipYFace
} from "./math.ts";

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

/**
 * One emitted polygon of a block variant, fully resolved at compile time:
 * rotation, mirroring, atlas UV mapping and flip-Y winding are already baked
 * in, so emitting it is a copy plus a translation by the voxel position.
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
  /** `vertexCount × 2` atlas UVs. */
  uvs: Float32Array;
  normalX: number;
  normalY: number;
  normalZ: number;
}

export interface BlockVariant {
  faces: readonly BlockVariantFace[];
  /** Bit `f` is set when this variant fully covers world-space face `f`. */
  occlusionMask: number;
}

export interface BlockVariantCacheOptions {
  blockRegistry: BlockRegistry;
  shapeRegistry: BlockShapeRegistry;
  tilesetManager: TilesetManager;
}

/**
 * Compiles and memoizes the geometry of a (blockId, transform) pair.
 *
 * Without it the mesh builder redoes the same per-vertex rotation, mirroring
 * and atlas UV arithmetic for every voxel in the world; a terrain chunk holds
 * millions of voxels but only a handful of distinct variants.
 *
 * Entries are dropped as soon as the block, shape or tileset registries report
 * a new `version`, so runtime registration stays correct.
 */
export class BlockVariantCache {
  #blockRegistry: BlockRegistry;
  #shapeRegistry: BlockShapeRegistry;
  #tilesetManager: TilesetManager;

  #variants = new Map<number, BlockVariant | null>();
  #slots = new Map<string, number>();
  #tilesetIds: string[] = [];

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
   * call. Cheap enough (three integer comparisons) to run before each chunk.
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
  }

  /**
   * Returns null when the block or its shape is unknown — such a voxel emits
   * no geometry and occludes nothing.
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

  tilesetIdAt(
    slot: number
  ): string {
    return this.#tilesetIds[slot];
  }

  #slotFor(
    tilesetId: string
  ): number {
    let slot = this.#slots.get(tilesetId);
    if (slot === undefined) {
      slot = this.#tilesetIds.length;
      this.#tilesetIds.push(tilesetId);
      this.#slots.set(tilesetId, slot);
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
      const uvs = new Float32Array(vertexCount * 2);

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
        uvs[i * 2] = uvRegion.offsetU + (uvRegion.scaleU * tileUV[0]);
        uvs[(i * 2) + 1] = uvRegion.offsetV + (uvRegion.scaleV * tileUV[1]);
      }

      const normal = rotateNormal(
        faceDef.normal,
        rotation,
        { flipX, flipZ, flipY }
      );

      faces.push({
        cull,
        slot: this.#slotFor(tileRef.tilesetId ?? this.#tilesetManager.defaultTilesetId!),
        vertexCount,
        indexCount: vertexCount === 4 ? 6 : 3,
        positions,
        uvs,
        normalX: normal[0],
        normalY: normal[1],
        normalZ: normal[2]
      });
    }

    return {
      faces,
      occlusionMask: this.#occlusionMask(shape, rotation, flipY)
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
