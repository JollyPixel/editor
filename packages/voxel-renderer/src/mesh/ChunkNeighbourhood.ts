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
 * front keeps the hot path simple.
 */
export class LayerChunkCache {
  readonly layer: VoxelLayer;
  /** Translucent layers never occlude a neighbouring face. */
  readonly opaque: boolean;
  /** True when the layer holds no chunk anywhere in the prefetched window. */
  readonly empty: boolean = true;

  #size: number;
  /** log2(size) when the chunk size is a power of two, -1 otherwise. */
  #shift: number;
  #offsetX: number;
  #offsetY: number;
  #offsetZ: number;
  #baseCx: number;
  #baseCy: number;
  #baseCz: number;
  #chunks: (VoxelChunk | undefined)[] = [];

  constructor(
    options: LayerChunkCacheOptions
  ) {
    const { layer, chunkSize, minWx, minWy, minWz } = options;

    this.layer = layer;
    this.opaque = layer.opacity >= 1;

    this.#size = chunkSize;
    this.#shift = (chunkSize & (chunkSize - 1)) === 0 ?
      Math.log2(chunkSize) :
      -1;

    const { offset } = layer;
    this.#offsetX = offset.x;
    this.#offsetY = offset.y;
    this.#offsetZ = offset.z;

    this.#baseCx = Math.floor((minWx - offset.x) / chunkSize);
    this.#baseCy = Math.floor((minWy - offset.y) / chunkSize);
    this.#baseCz = Math.floor((minWz - offset.z) / chunkSize);

    for (let dx = 0; dx < kSpan; dx++) {
      for (let dy = 0; dy < kSpan; dy++) {
        for (let dz = 0; dz < kSpan; dz++) {
          const chunk = layer.getChunk(
            this.#baseCx + dx,
            this.#baseCy + dy,
            this.#baseCz + dz
          );
          this.#chunks[(dx * 9) + (dy * kSpan) + dz] = chunk;

          if (chunk !== undefined) {
            this.empty = false;
          }
        }
      }
    }
  }

  /** `VOXEL_ABSENT` (-1) when the position holds no voxel in this layer. */
  packedAt(
    wx: number,
    wy: number,
    wz: number
  ): PackedVoxel {
    const size = this.#size;
    const shift = this.#shift;
    const x = wx - this.#offsetX;
    const y = wy - this.#offsetY;
    const z = wz - this.#offsetZ;

    let cx: number;
    let cy: number;
    let cz: number;
    let lx: number;
    let ly: number;
    let lz: number;

    if (shift >= 0) {
      const mask = size - 1;
      cx = x >> shift;
      cy = y >> shift;
      cz = z >> shift;
      lx = x & mask;
      ly = y & mask;
      lz = z & mask;
    }
    else {
      cx = Math.floor(x / size);
      cy = Math.floor(y / size);
      cz = Math.floor(z / size);
      lx = x - (cx * size);
      ly = y - (cy * size);
      lz = z - (cz * size);
    }

    const dx = cx - this.#baseCx;
    const dy = cy - this.#baseCy;
    const dz = cz - this.#baseCz;

    // Outside the prefetched window only when a caller queries beyond the
    // one-voxel border the cache was built for; fall back to the layer.
    const chunk = (dx | dy | dz) >= 0 && dx < kSpan && dy < kSpan && dz < kSpan ?
      this.#chunks[(dx * 9) + (dy * kSpan) + dz] :
      this.layer.getChunk(cx, cy, cz);

    if (chunk === undefined || !chunk.mayContain(lx, ly, lz)) {
      return VOXEL_ABSENT;
    }

    return chunk.getPackedAt(lx, ly, lz);
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

      const variant = this.#variants.get(
        voxelBlockId(neighbour),
        voxelTransform(neighbour)
      );

      return variant !== null && (variant.occlusionMask & (1 << oppFace)) !== 0;
    }

    return false;
  }
}
