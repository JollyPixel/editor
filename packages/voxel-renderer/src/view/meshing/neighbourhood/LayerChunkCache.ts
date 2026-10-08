// Import Internal Dependencies
import type {
  MeshableChunk,
  MeshableLayer
} from "../types.ts";
import {
  VOXEL_ABSENT,
  type PackedVoxel
} from "../../../document/world/storage/packedVoxel.ts";

// CONSTANTS
const kSpan = 3;
const kUnresolved = -2;

export interface LayerChunkCacheOptions {
  layer: MeshableLayer;
  chunkSize: number;
  minWx: number;
  minWy: number;
  minWz: number;
  /**
   * Reusable `(chunkSize + 2)³` scratch memoizing every lookup inside the
   * padded chunk box. Its previous content is discarded.
   */
  window?: Int32Array | null;
}

/**
 * Prefetches a 3×3×3 chunk window for hot-path voxel lookup.
 */
export class LayerChunkCache {
  readonly layer: MeshableLayer;
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
  /**
   * Pre-filled with `null` rather than left holey, so reads stay monomorphic.
   */
  // oxlint-disable-next-line unicorn/no-new-array
  #chunks: (MeshableChunk | null)[] = new Array(kSpan ** 3).fill(null);

  #centreWx: number;
  #centreWy: number;
  #centreWz: number;
  #centreChunk: MeshableChunk | null = null;

  #window: Int32Array | null = null;
  #pendingWindow: Int32Array | null = null;
  #windowSpan: number;
  #minWx: number;
  #minWy: number;
  #minWz: number;

  constructor(
    options: LayerChunkCacheOptions
  ) {
    const { layer, chunkSize, minWx, minWy, minWz } = options;

    this.layer = layer;

    const shift = Math.log2(chunkSize);
    this.#size = chunkSize;
    this.#shift = shift;
    this.#mask = chunkSize - 1;

    const { position } = layer;
    this.#offsetX = position.x;
    this.#offsetY = position.y;
    this.#offsetZ = position.z;

    const baseCx = (minWx - position.x) >> shift;
    const baseCy = (minWy - position.y) >> shift;
    const baseCz = (minWz - position.z) >> shift;
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

    this.#centreWx = ((baseCx + 1) * chunkSize) + position.x;
    this.#centreWy = ((baseCy + 1) * chunkSize) + position.y;
    this.#centreWz = ((baseCz + 1) * chunkSize) + position.z;
    this.#centreChunk = this.#chunks[(kSpan * kSpan) + kSpan + 1];

    this.#windowSpan = chunkSize + 2;
    this.#minWx = minWx;
    this.#minWy = minWy;
    this.#minWz = minWz;

    const { window = null } = options;
    if (!this.empty) {
      this.#pendingWindow = window;
    }
  }

  packedAt(
    wx: number,
    wy: number,
    wz: number
  ): PackedVoxel {
    let window = this.#window;
    if (window === null) {
      if (this.#pendingWindow === null) {
        return this.#lookup(wx, wy, wz);
      }

      window = this.#prepareWindow(this.#pendingWindow);
    }

    const span = this.#windowSpan;
    const x = wx - this.#minWx;
    const y = wy - this.#minWy;
    const z = wz - this.#minWz;
    if ((x | y | z) < 0 || x >= span || y >= span || z >= span) {
      return this.#lookup(wx, wy, wz);
    }

    const index = x + (span * (y + (span * z)));
    let packed = window[index];
    if (packed === kUnresolved) {
      packed = this.#lookup(wx, wy, wz);
      window[index] = packed;
    }

    return packed;
  }

  #prepareWindow(
    window: Int32Array
  ): Int32Array {
    const span = this.#windowSpan;
    if (window.length < span * span * span) {
      throw new RangeError(
        `LayerChunkCache: window needs ${span ** 3} cells, got ${window.length}.`
      );
    }

    this.#window = window;
    this.#pendingWindow = null;

    const chunk = this.#centreChunk;
    if (
      chunk === null ||
      this.#centreWx !== this.#minWx + 1 ||
      this.#centreWy !== this.#minWy + 1 ||
      this.#centreWz !== this.#minWz + 1
    ) {
      window.fill(kUnresolved);

      return window;
    }

    fillUnresolvedShell(window, span);
    const { shift, mask } = chunk;
    const shiftZ = shift * 2;
    const { keys, values, capacity } = chunk.store;
    for (let slot = 0; slot < capacity; slot++) {
      const linearIdx = keys[slot];
      if (linearIdx < 0) {
        continue;
      }

      const x = (linearIdx & mask) + 1;
      const y = ((linearIdx >> shift) & mask) + 1;
      const z = (linearIdx >> shiftZ) + 1;
      window[x + (span * (y + (span * z)))] = values[slot];
    }

    return window;
  }

  #lookup(
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
        chunk.storedAt(lx, ly, lz);
    }

    return this.#packedOutsideCentre(wx, wy, wz);
  }

  partnerAt(
    wx: number,
    wy: number,
    wz: number
  ): PackedVoxel {
    const x = wx - this.#offsetX;
    const y = wy - this.#offsetY;
    const z = wz - this.#offsetZ;
    const chunk = this.#chunkOf(x, y, z);
    const mask = this.#mask;

    return chunk === null ?
      VOXEL_ABSENT :
      chunk.getPartnerAt(x & mask, y & mask, z & mask);
  }

  #packedOutsideCentre(
    wx: number,
    wy: number,
    wz: number
  ): PackedVoxel {
    const mask = this.#mask;
    const x = wx - this.#offsetX;
    const y = wy - this.#offsetY;
    const z = wz - this.#offsetZ;
    const chunk = this.#chunkOf(x, y, z);
    if (chunk === null) {
      return VOXEL_ABSENT;
    }

    const lx = x & mask;
    const ly = y & mask;
    const lz = z & mask;

    return chunk.mayContain(lx, ly, lz) ?
      chunk.storedAt(lx, ly, lz) :
      VOXEL_ABSENT;
  }

  #chunkOf(
    x: number,
    y: number,
    z: number
  ): MeshableChunk | null {
    const shift = this.#shift;
    const cx = x >> shift;
    const cy = y >> shift;
    const cz = z >> shift;

    const dx = cx - this.#baseCx;
    const dy = cy - this.#baseCy;
    const dz = cz - this.#baseCz;

    return (dx | dy | dz) >= 0 && dx < kSpan && dy < kSpan && dz < kSpan ?
      this.#chunks[(dx * kSpan * kSpan) + (dy * kSpan) + dz] :
      this.layer.getChunk(cx, cy, cz) ?? null;
  }
}

function fillUnresolvedShell(
  window: Int32Array,
  span: number
): void {
  const last = span - 1;
  const plane = span * span;

  window.fill(VOXEL_ABSENT);
  window.fill(kUnresolved, 0, plane);
  window.fill(kUnresolved, last * plane, plane * span);
  for (let z = 1; z < last; z++) {
    const base = z * plane;
    window.fill(kUnresolved, base, base + span);
    window.fill(kUnresolved, base + (last * span), base + plane);
    for (let y = 1; y < last; y++) {
      const row = base + (y * span);
      window[row] = kUnresolved;
      window[row + last] = kUnresolved;
    }
  }
}
