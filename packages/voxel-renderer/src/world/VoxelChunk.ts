// Import Internal Dependencies
import type { VoxelEntry } from "./types.ts";
import { VoxelStore } from "./VoxelStore.ts";
import { assertPowerOfTwoChunkSize } from "../utils/math.ts";
import {
  packVoxel,
  unpackVoxel,
  VOXEL_ABSENT,
  type PackedVoxel
} from "./packedVoxel.ts";

// CONSTANTS
export const DEFAULT_CHUNK_SIZE = 16;

export type VoxelLinearCoords = [number, number, number];

/**
 * Fixed-size sparse grid storing voxels as packed integers.
 */
export class VoxelChunk {
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;
  readonly size: number;
  readonly shift: number;
  readonly mask: number;

  /**
   * Exposes packed storage for mesh-builder hot paths.
   */
  readonly store = new VoxelStore();

  dirty = true;

  /**
   * Conservative bounds that widen on writes but do not shrink on deletion.
   */
  #minX: number;
  #minY: number;
  #minZ: number;
  #maxX = -1;
  #maxY = -1;
  #maxZ = -1;

  constructor(
    [cx, cy, cz]: [number, number, number],
    size: number = DEFAULT_CHUNK_SIZE
  ) {
    assertPowerOfTwoChunkSize(size, "VoxelChunk");

    this.cx = cx;
    this.cy = cy;
    this.cz = cz;
    this.size = size;
    this.shift = Math.log2(size);
    this.mask = size - 1;

    this.#minX = size;
    this.#minY = size;
    this.#minZ = size;
  }

  /**
   * Packs local coordinates into disjoint bit fields.
   */
  linearIndex(
    lx: number,
    ly: number,
    lz: number
  ): number {
    const shift = this.shift;

    return lx | (ly << shift) | (lz << (shift * 2));
  }

  fromLinearIndex(
    idx: number
  ): { lx: number; ly: number; lz: number; } {
    const { shift, mask } = this;

    return {
      lx: idx & mask,
      ly: (idx >> shift) & mask,
      lz: idx >> (shift * 2)
    };
  }

  get(
    coords: VoxelLinearCoords
  ): VoxelEntry | undefined {
    const [lx, ly, lz] = coords;

    return this.getAt(lx, ly, lz);
  }

  getAt(
    lx: number,
    ly: number,
    lz: number
  ): VoxelEntry | undefined {
    const packed = this.getPackedAt(lx, ly, lz);

    return packed === VOXEL_ABSENT ? undefined : unpackVoxel(packed);
  }

  getPackedAt(
    lx: number,
    ly: number,
    lz: number
  ): PackedVoxel {
    return this.store.get(
      this.linearIndex(lx, ly, lz)
    );
  }

  set(
    coords: VoxelLinearCoords,
    entry: VoxelEntry
  ): void {
    const [lx, ly, lz] = coords;

    this.setPackedAt(
      lx, ly, lz, packVoxel(entry.blockId, entry.transform)
    );
  }

  setPackedAt(
    lx: number,
    ly: number,
    lz: number,
    packed: PackedVoxel
  ): void {
    this.store.set(
      this.linearIndex(lx, ly, lz),
      packed
    );
    this.dirty = true;

    if (lx < this.#minX) {
      this.#minX = lx;
    }
    if (lx > this.#maxX) {
      this.#maxX = lx;
    }
    if (ly < this.#minY) {
      this.#minY = ly;
    }
    if (ly > this.#maxY) {
      this.#maxY = ly;
    }
    if (lz < this.#minZ) {
      this.#minZ = lz;
    }
    if (lz > this.#maxZ) {
      this.#maxZ = lz;
    }
  }

  /**
   * Rejects positions outside conservative bounds without a store lookup.
   */
  mayContain(
    lx: number,
    ly: number,
    lz: number
  ): boolean {
    return lx >= this.#minX && lx <= this.#maxX &&
      ly >= this.#minY && ly <= this.#maxY &&
      lz >= this.#minZ && lz <= this.#maxZ;
  }

  delete(
    coords: VoxelLinearCoords
  ): boolean {
    const [lx, ly, lz] = coords;
    const deleted = this.store.delete(
      this.linearIndex(lx, ly, lz)
    );
    if (deleted) {
      this.dirty = true;
    }

    return deleted;
  }

  isEmpty(): boolean {
    return this.store.size === 0;
  }

  * entries(): IterableIterator<[number, VoxelEntry]> {
    const { keys, values, capacity } = this.store;

    for (let slot = 0; slot < capacity; slot++) {
      const key = keys[slot];
      if (key >= 0) {
        yield [key, unpackVoxel(values[slot])];
      }
    }
  }

  * packedEntries(): IterableIterator<[number, PackedVoxel]> {
    const { keys, values, capacity } = this.store;

    for (let slot = 0; slot < capacity; slot++) {
      const key = keys[slot];
      if (key >= 0) {
        yield [key, values[slot]];
      }
    }
  }

  get voxelCount(): number {
    return this.store.size;
  }

  toString(): string {
    return `${this.cx},${this.cy},${this.cz}`;
  }
}
