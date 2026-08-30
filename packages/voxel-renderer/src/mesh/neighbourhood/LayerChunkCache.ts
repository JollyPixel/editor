// Import Internal Dependencies
import type { VoxelChunk } from "../../world/VoxelChunk.ts";
import type { VoxelLayer } from "../../world/VoxelLayer.ts";
import {
  VOXEL_ABSENT,
  type PackedVoxel
} from "../../world/packedVoxel.ts";

// CONSTANTS
const kSpan = 3;

export interface LayerChunkCacheOptions {
  layer: VoxelLayer;
  chunkSize: number;
  minWx: number;
  minWy: number;
  minWz: number;
}

/**
 * Prefetches a 3×3×3 chunk window for hot-path voxel lookup.
 */
export class LayerChunkCache {
  readonly layer: VoxelLayer;
  readonly opaque: boolean;
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
   * Reads outer chunks or falls back beyond the cached border.
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
