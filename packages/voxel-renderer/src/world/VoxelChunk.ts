// Import Internal Dependencies
import type { VoxelEntry } from "./types.ts";

// CONSTANTS
export const DEFAULT_CHUNK_SIZE = 16;

export type VoxelLinearCoords = [number, number, number];

/**
 * A fixed-size 3-D grid of voxel data.
 * Local coordinates run from [0, size) on each axis.
 * Internally uses a sparse Map so empty chunks carry no memory cost.
 *
 * `dirty` is set to true by any write and cleared by VoxelRenderer after
 * the chunk's mesh has been rebuilt.
 */
export class VoxelChunk {
  /** Chunk coordinates (not world coordinates) */
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;
  readonly size: number;

  dirty = true;

  #data = new Map<number, VoxelEntry>();

  /**
   * Conservative local-space bounds of the written voxels. Only widened, never
   * shrunk on delete, so it always contains every entry — see `mayContain()`.
   * An empty chunk keeps the inverted range, which contains nothing.
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
   * Same as `get()` without the tuple. Used on the mesh builder's hot path,
   * where the array literal `get()` requires is allocated millions of times.
   */
  getAt(
    lx: number,
    ly: number,
    lz: number
  ): VoxelEntry | undefined {
    return this.#data.get(
      this.linearIndex(lx, ly, lz)
    );
  }

  set(
    coords: VoxelLinearCoords,
    entry: VoxelEntry
  ): void {
    const [lx, ly, lz] = coords;

    this.#data.set(
      this.linearIndex(lx, ly, lz),
      entry
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
   * `getAt()` to confirm; the point is to answer the common "nowhere near any
   * voxel" case with six comparisons instead of a hash lookup.
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
    const deleted = this.#data.delete(
      this.linearIndex(lx, ly, lz)
    );
    if (deleted) {
      this.dirty = true;
    }

    return deleted;
  }

  isEmpty(): boolean {
    return this.#data.size === 0;
  }

  entries(): IterableIterator<[number, VoxelEntry]> {
    return this.#data.entries();
  }

  get voxelCount(): number {
    return this.#data.size;
  }

  toString(): string {
    return `${this.cx},${this.cy},${this.cz}`;
  }
}
