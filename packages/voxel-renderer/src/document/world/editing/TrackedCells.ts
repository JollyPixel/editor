// Import Internal Dependencies
import { VoxelStore } from "../storage/VoxelStore.ts";
import type { PackedVoxel } from "../storage/packedVoxel.ts";

// CONSTANTS
const kInitialEntries = 16;
const kStride = 5;
const kCell = 0;
const kBefore = 1;
const kAfter = 2;
const kBeforePartner = 3;
const kAfterPartner = 4;

// eslint-disable-next-line max-params
export type TrackedCellVisitor = (
  cell: number,
  before: PackedVoxel,
  after: PackedVoxel,
  beforePartner: PackedVoxel,
  afterPartner: PackedVoxel,
  reach: number
) => void;

export class TrackedCells {
  originX = 0;
  originY = 0;
  originZ = 0;

  #entryIndices = new VoxelStore();
  #entries = new Int32Array(kInitialEntries * kStride);
  #reach = new Uint8Array(kInitialEntries);
  #size = 0;

  get size(): number {
    return this.#size;
  }

  entryIndex(
    cell: number
  ): number {
    return this.#entryIndices.get(cell);
  }

  // eslint-disable-next-line max-params
  track(
    cell: number,
    before: PackedVoxel,
    beforePartner: PackedVoxel,
    reach: number
  ): number {
    const entry = this.#size++;
    if (entry === this.#reach.length) {
      this.#grow();
    }

    const offset = entry * kStride;
    this.#entries[offset + kCell] = cell;
    this.#entries[offset + kBefore] = before;
    this.#entries[offset + kBeforePartner] = beforePartner;
    this.#reach[entry] = reach;
    this.#entryIndices.set(cell, entry);

    return entry;
  }

  write(
    entry: number,
    after: PackedVoxel,
    afterPartner: PackedVoxel
  ): void {
    const offset = entry * kStride;
    this.#entries[offset + kAfter] = after;
    this.#entries[offset + kAfterPartner] = afterPartner;
  }

  drain(
    visit: TrackedCellVisitor
  ): void {
    const entries = this.#entries;
    for (let entry = 0; entry < this.#size; entry++) {
      const offset = entry * kStride;
      visit(
        entries[offset + kCell],
        entries[offset + kBefore],
        entries[offset + kAfter],
        entries[offset + kBeforePartner],
        entries[offset + kAfterPartner],
        this.#reach[entry]
      );
    }

    this.#size = 0;
    this.#entryIndices.clear();
  }

  #grow(): void {
    const entries = new Int32Array(this.#entries.length * 2);
    entries.set(this.#entries);
    this.#entries = entries;

    const reach = new Uint8Array(this.#reach.length * 2);
    reach.set(this.#reach);
    this.#reach = reach;
  }
}
