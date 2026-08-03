// Import Internal Dependencies
import type { VoxelWorld } from "../world/VoxelWorld.ts";
import type { VoxelChunk } from "../world/VoxelChunk.ts";
import type { VoxelLayer } from "../world/VoxelLayer.ts";
import type { BlockVariantCache } from "./BlockVariantCache.ts";
import {
  voxelBlockId,
  voxelTransform,
  VOXEL_ABSENT,
  type PackedVoxel
} from "../world/packedVoxel.ts";

// CONSTANTS
// A region one chunk wide plus a one-voxel border spans at most 3 chunks per axis.
const kSpan = 3;

export interface LayerChunkCacheOptions {
  layer: VoxelLayer;
  chunkSize: number;
  minWx: number;
  minWy: number;
  minWz: number;
}

/**
 * Per-layer voxel lookup over a prefetched 3×3×3 block of chunks.
 *
 * The mesh builder calls this for each face, so resolving the chunks once up
 * front keeps the hot path simple. Most queries land in the window's centre
 * chunk — every voxel of the chunk being meshed does, and only its one-voxel
 * border does not — so that case is answered without any chunk-grid arithmetic.
 */
export class LayerChunkCache {
  readonly layer: VoxelLayer;
  /** Translucent layers never occlude a neighbouring face. */
  readonly opaque: boolean;
  /** True when the layer holds no chunk anywhere in the prefetched window. */
  readonly empty: boolean = true;

  #size: number;
  #shift: number;
  #mask: number;
  #offsetX: number;
  #offsetY: number;
  #offsetZ: number;
  #baseCx: number;
  #baseCy: number;
  #baseCz: number;
  /** Pre-filled with `null` rather than left holey, so reads stay monomorphic. */
  #chunks: (VoxelChunk | null)[] = new Array(kSpan ** 3).fill(null);

  /** World-space origin of the window's centre chunk, and the chunk itself. */
  #centreWx: number;
  #centreWy: number;
  #centreWz: number;
  #centreChunk: VoxelChunk | null = null;

  constructor(
    options: LayerChunkCacheOptions
  ) {
    const { layer, chunkSize, minWx, minWy, minWz } = options;

    this.layer = layer;
    this.opaque = layer.opacity >= 1;

    const shift = Math.log2(chunkSize);
    this.#size = chunkSize;
    this.#shift = shift;
    this.#mask = chunkSize - 1;

    const { offset } = layer;
    this.#offsetX = offset.x;
    this.#offsetY = offset.y;
    this.#offsetZ = offset.z;

    const baseCx = (minWx - offset.x) >> shift;
    const baseCy = (minWy - offset.y) >> shift;
    const baseCz = (minWz - offset.z) >> shift;
    this.#baseCx = baseCx;
    this.#baseCy = baseCy;
    this.#baseCz = baseCz;

    for (let dx = 0; dx < kSpan; dx++) {
      for (let dy = 0; dy < kSpan; dy++) {
        for (let dz = 0; dz < kSpan; dz++) {
          const chunk = layer.getChunk(baseCx + dx, baseCy + dy, baseCz + dz);
          if (chunk === undefined) {
            continue;
          }

          this.#chunks[(dx * kSpan * kSpan) + (dy * kSpan) + dz] = chunk;
          this.empty = false;
        }
      }
    }

    this.#centreWx = ((baseCx + 1) * chunkSize) + offset.x;
    this.#centreWy = ((baseCy + 1) * chunkSize) + offset.y;
    this.#centreWz = ((baseCz + 1) * chunkSize) + offset.z;
    this.#centreChunk = this.#chunks[(kSpan * kSpan) + kSpan + 1];
  }

  /** `VOXEL_ABSENT` (-1) when the position holds no voxel in this layer. */
  packedAt(
    wx: number,
    wy: number,
    wz: number
  ): PackedVoxel {
    const size = this.#size;
    const lx = wx - this.#centreWx;
    const ly = wy - this.#centreWy;
    const lz = wz - this.#centreWz;

    if ((lx | ly | lz) >= 0 && lx < size && ly < size && lz < size) {
      const chunk = this.#centreChunk;

      return chunk === null || !chunk.mayContain(lx, ly, lz) ?
        VOXEL_ABSENT :
        chunk.getPackedAt(lx, ly, lz);
    }

    return this.#packedOutsideCentre(wx, wy, wz);
  }

  /**
   * The window's 26 outer chunks, plus the fallback for a caller reaching past
   * the one-voxel border the cache was built for.
   */
  #packedOutsideCentre(
    wx: number,
    wy: number,
    wz: number
  ): PackedVoxel {
    const shift = this.#shift;
    const mask = this.#mask;
    const x = wx - this.#offsetX;
    const y = wy - this.#offsetY;
    const z = wz - this.#offsetZ;

    const cx = x >> shift;
    const cy = y >> shift;
    const cz = z >> shift;

    const dx = cx - this.#baseCx;
    const dy = cy - this.#baseCy;
    const dz = cz - this.#baseCz;

    const chunk = (dx | dy | dz) >= 0 && dx < kSpan && dy < kSpan && dz < kSpan ?
      this.#chunks[(dx * kSpan * kSpan) + (dy * kSpan) + dz] :
      this.layer.getChunk(cx, cy, cz) ?? null;

    if (chunk === null) {
      return VOXEL_ABSENT;
    }

    const lx = x & mask;
    const ly = y & mask;
    const lz = z & mask;

    return chunk.mayContain(lx, ly, lz) ?
      chunk.getPackedAt(lx, ly, lz) :
      VOXEL_ABSENT;
  }
}

export interface ChunkNeighbourhoodOptions {
  world: VoxelWorld;
  variants: BlockVariantCache;
  /** The layer being meshed, which fixes `selfIndex`. */
  layer: VoxelLayer;
  minWx: number;
  minWy: number;
  minWz: number;
}

/**
 * Every effectively visible layer of the world, in compositing order.
 *
 * It also answers the two occlusion checks the mesh builder uses.
 */
export class ChunkNeighbourhood {
  readonly layers: readonly LayerChunkCache[];
  /** Rank of the layer being meshed among `layers`, or -1 when it is hidden. */
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
      // A layer with no chunk in the window can neither win compositing nor
      // occlude anywhere the builder looks, so it is dropped from the walk.
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
   * True when the layer being meshed owns what the world composites at
   * `(wx, wy, wz)`, meaning no higher-priority layer covers the position.
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
   * True when the neighbour voxel exists, belongs to an opaque layer and its
   * shape occludes `oppFace`.
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
