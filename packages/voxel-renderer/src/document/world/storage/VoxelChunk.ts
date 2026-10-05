// Import Internal Dependencies
import type { VoxelEntry } from "../types.ts";
import { VoxelStore } from "./VoxelStore.ts";
import { assertPowerOfTwoChunkSize } from "./chunkSize.ts";
import {
  packVoxel,
  unpackVoxel,
  voxelBlockId,
  VOXEL_ABSENT,
  type PackedVoxel
} from "./packedVoxel.ts";
import {
  cellPartner,
  cellPrimary,
  isMergedVoxel,
  markMerged,
  unmarkMerged
} from "./mergedVoxel.ts";

// CONSTANTS
export const DEFAULT_CHUNK_SIZE = 16;

export type VoxelLinearCoords = [number, number, number];

export type VoxelChunkDirtyListener = (
  chunk: VoxelChunk,
  dirty: boolean
) => void;

/**
 * Fixed-size sparse grid storing voxels as packed integers.
 */
export class VoxelChunk {
  readonly store = new VoxelStore();

  readonly cx: number;
  readonly cy: number;
  readonly cz: number;
  readonly size: number;
  readonly shift: number;
  readonly mask: number;

  #partners: VoxelStore | null = null;

  #dirty = true;
  #dirtyListeners = new Set<VoxelChunkDirtyListener>();

  #minX: number;
  #minY: number;
  #minZ: number;
  #maxX = -1;
  #maxY = -1;
  #maxZ = -1;

  #revision = 0;
  #blockCounts: ReadonlyMap<number, number> = new Map();
  #blockCountsRevision = 0;

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

  get dirty(): boolean {
    return this.#dirty;
  }

  set dirty(
    value: boolean
  ) {
    if (value === this.#dirty) {
      return;
    }

    this.#dirty = value;
    for (const listener of this.#dirtyListeners) {
      listener(this, value);
    }
  }

  onDirtyChange(
    listener: VoxelChunkDirtyListener
  ): () => void {
    this.#dirtyListeners.add(listener);
    if (this.#dirty) {
      listener(this, true);
    }

    return () => {
      this.#dirtyListeners.delete(listener);
    };
  }

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
    const index = this.linearIndex(lx, ly, lz);
    const packed = this.store.get(index);

    return packed === VOXEL_ABSENT ?
      undefined :
      this.#entryOf(index, packed);
  }

  get partners(): VoxelStore | null {
    return this.#partners;
  }

  getPartnerAt(
    lx: number,
    ly: number,
    lz: number
  ): PackedVoxel {
    const index = this.linearIndex(lx, ly, lz);

    return this.#partnerOf(index, this.store.get(index));
  }

  #partnerOf(
    index: number,
    packed: PackedVoxel
  ): PackedVoxel {
    return isMergedVoxel(packed) && this.#partners !== null ?
      this.#partners.get(index) :
      VOXEL_ABSENT;
  }

  #entryOf(
    index: number,
    packed: PackedVoxel
  ): VoxelEntry {
    const entry = unpackVoxel(packed);
    const partner = this.#partnerOf(index, packed);
    if (partner !== VOXEL_ABSENT) {
      entry.partner = unpackVoxel(partner);
    }

    return entry;
  }

  getPackedAt(
    lx: number,
    ly: number,
    lz: number
  ): PackedVoxel {
    return unmarkMerged(this.storedAt(lx, ly, lz));
  }

  storedAt(
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
    const { partner } = entry;

    this.setPackedAt(
      lx,
      ly,
      lz,
      packVoxel(entry.blockId, entry.transform),
      partner === undefined ?
        VOXEL_ABSENT :
        packVoxel(partner.blockId, partner.transform)
    );
  }

  setPackedAt(
    lx: number,
    ly: number,
    lz: number,
    packed: PackedVoxel,
    partner: PackedVoxel = VOXEL_ABSENT
  ): void {
    this.#writeCell(this.linearIndex(lx, ly, lz), packed, partner);
    this.dirty = true;
    this.#revision++;

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

  #writeCell(
    index: number,
    packed: PackedVoxel,
    partner: PackedVoxel
  ): void {
    const primary = unmarkMerged(packed);
    if (partner === VOXEL_ABSENT) {
      this.store.set(index, primary);
      this.#partners?.delete(index);

      return;
    }

    const other = unmarkMerged(partner);
    this.store.set(index, markMerged(cellPrimary(primary, other)));
    this.#partnerStore().set(index, cellPartner(primary, other));
  }

  #partnerStore(): VoxelStore {
    if (this.#partners === null) {
      this.#partners = new VoxelStore();
      if (this.store.shared) {
        this.#partners.share();
      }
    }

    return this.#partners;
  }

  share(): void {
    this.store.share();
    this.#partners?.share();
  }

  loadPackedEntries(
    cells: ArrayLike<number>,
    voxels: ArrayLike<PackedVoxel>,
    partners?: ArrayLike<PackedVoxel>
  ): void {
    const { shift, mask } = this;
    const count = cells.length;
    if (count === 0) {
      return;
    }

    this.store.reserve(this.store.size + count);

    let minX = this.#minX;
    let minY = this.#minY;
    let minZ = this.#minZ;
    let maxX = this.#maxX;
    let maxY = this.#maxY;
    let maxZ = this.#maxZ;
    for (let i = 0; i < count; i++) {
      const cell = cells[i];
      this.#writeCell(
        cell,
        voxels[i],
        partners === undefined ? VOXEL_ABSENT : partners[i]
      );

      const lx = cell & mask;
      const ly = (cell >> shift) & mask;
      const lz = cell >> (shift * 2);
      minX = Math.min(minX, lx);
      minY = Math.min(minY, ly);
      minZ = Math.min(minZ, lz);
      maxX = Math.max(maxX, lx);
      maxY = Math.max(maxY, ly);
      maxZ = Math.max(maxZ, lz);
    }

    this.#minX = minX;
    this.#minY = minY;
    this.#minZ = minZ;
    this.#maxX = maxX;
    this.#maxY = maxY;
    this.#maxZ = maxZ;
    this.dirty = true;
    this.#revision++;
  }

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
    const index = this.linearIndex(lx, ly, lz);
    const deleted = this.store.delete(index);
    if (deleted) {
      this.#partners?.delete(index);
      this.dirty = true;
      this.#revision++;
    }

    return deleted;
  }

  isEmpty(): boolean {
    return this.store.size === 0;
  }

  clone(): VoxelChunk {
    const copy = new VoxelChunk(
      [this.cx, this.cy, this.cz],
      this.size
    );

    copy.copyFrom(this);

    return copy;
  }

  copyFrom(
    source: VoxelChunk
  ): void {
    if (source.size !== this.size) {
      throw new RangeError(
        `VoxelChunk: cannot copy size ${source.size} into size ${this.size}.`
      );
    }

    this.store.copyFrom(source.store);
    if (source.#partners === null) {
      this.#partners?.clear();
    }
    else {
      this.#partnerStore().copyFrom(source.#partners);
    }
    this.#minX = source.#minX;
    this.#minY = source.#minY;
    this.#minZ = source.#minZ;
    this.#maxX = source.#maxX;
    this.#maxY = source.#maxY;
    this.#maxZ = source.#maxZ;
    this.dirty = true;
    this.#revision++;
  }

  * entries(): IterableIterator<[number, VoxelEntry]> {
    const { keys, values, capacity } = this.store;

    for (let slot = 0; slot < capacity; slot++) {
      const key = keys[slot];
      if (key >= 0) {
        yield [key, this.#entryOf(key, values[slot])];
      }
    }
  }

  * packedEntries(): IterableIterator<[number, PackedVoxel, PackedVoxel]> {
    const { keys, values, capacity } = this.store;

    for (let slot = 0; slot < capacity; slot++) {
      const key = keys[slot];
      if (key >= 0) {
        const packed = values[slot];

        yield [key, unmarkMerged(packed), this.#partnerOf(key, packed)];
      }
    }
  }

  get voxelCount(): number {
    return this.store.size;
  }

  get revision(): number {
    return this.#revision;
  }

  countBlocks(): ReadonlyMap<number, number> {
    if (this.#blockCountsRevision === this.#revision) {
      return this.#blockCounts;
    }

    const counts = new Map<number, number>();
    for (const store of [this.store, this.#partners]) {
      if (store === null) {
        continue;
      }

      const { keys, values, capacity } = store;
      for (let slot = 0; slot < capacity; slot++) {
        if (keys[slot] >= 0) {
          const blockId = voxelBlockId(values[slot]);
          counts.set(blockId, (counts.get(blockId) ?? 0) + 1);
        }
      }
    }
    this.#blockCounts = counts;
    this.#blockCountsRevision = this.#revision;

    return counts;
  }

  toString(): string {
    return `${this.cx},${this.cy},${this.cz}`;
  }
}
