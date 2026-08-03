// Import Internal Dependencies
import type { VoxelEntry } from "./types.ts";
import { VoxelStore } from "./VoxelStore.ts";
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
 * Fixed-size 3-D voxel grid.
 * Local coordinates run from [0, size) on each axis.
 * Empty chunks stay cheap because storage is a sparse `VoxelStore`.
 *
 * Voxels are stored as packed integers, not objects. `get()` and `entries()`
 * rebuild a `VoxelEntry` each time, so they do not preserve object identity.
 * Hot paths should use the packed variants.
 */
export class VoxelChunk {
  /** Chunk coordinates (not world coordinates). */
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;
  readonly size: number;

  /**
   * Backing storage. Exposed so mesh builders can walk `store.keys` and
   * `store.values` directly; not part of the stable API.
   */
  readonly store = new VoxelStore();

  dirty = true;

  /**
   * Conservative local-space bounds of written voxels. Only widened, never
   * shrunk on delete, so it always contains every entry. See `mayContain()`.
   * Empty chunks keep an inverted range, which contains nothing.
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
    this.cx = cx;
    this.cy = cy;
    this.cz = cz;
    this.size = size;

    this.#minX = size;
    this.#minY = size;
    this.#minZ = size;
  }

  linearIndex(
    lx: number,
    ly: number,
    lz: number
  ): number {
    return lx + (this.size * (ly + (this.size * lz)));
  }

  fromLinearIndex(
    idx: number
  ): { lx: number; ly: number; lz: number; } {
    const s = this.size;
    const lx = idx % s;
    const ly = Math.floor(idx / s) % s;
    const lz = Math.floor(idx / (s * s));

    return { lx, ly, lz };
  }

  get(
    coords: VoxelLinearCoords
  ): VoxelEntry | undefined {
    const [lx, ly, lz] = coords;

    return this.getAt(lx, ly, lz);
  }

  /**
   * Same as `get()` without the tuple.
   */
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
   * False when the position is provably empty. A `true` result still needs a
   * `getPackedAt()` to confirm, so this is a cheap pre-check.
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
