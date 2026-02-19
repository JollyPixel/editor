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

  constructor(
    [cx, cy, cz]: [number, number, number],
    size: number = DEFAULT_CHUNK_SIZE
  ) {
    this.cx = cx;
    this.cy = cy;
    this.cz = cz;
    this.size = size;
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
}
