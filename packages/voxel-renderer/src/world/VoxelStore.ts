// Import Internal Dependencies
import { VOXEL_ABSENT, type PackedVoxel } from "./packedVoxel.ts";

// CONSTANTS
const kInitialCapacity = 16;
/** Grow once three quarters of the slots are taken; linear probing degrades past that. */
const kLoadFactorNum = 3;
const kLoadFactorDen = 4;
/** Int32Array fill value marking a free slot. Linear indices are never negative. */
const kFreeKey = -1;
/** Knuth's multiplicative constant, 2^32 / φ rounded to an odd integer. */
const kGoldenRatio = 0x9E3779B1;

/**
 * Sparse voxel store backed by two typed arrays instead of a `Map`.
 *
 * A `Map` allocates a hash-table entry per voxel, which is costly in JS heap.
 * This version uses open addressing over `Int32Array` and `Uint32Array`, so it
 * stays compact and GC-friendly. Deletion reshuffles nearby entries to keep
 * clusters contiguous.
 */
export class VoxelStore {
  #keys: Int32Array;
  #values: Uint32Array;
  #mask: number;
  /** High-bit extraction shift; `32 - log2(capacity)`. */
  #shift: number;
  #size = 0;
  #growAt: number;

  constructor(
    initialCapacity: number = kInitialCapacity
  ) {
    const capacity = nextPowerOfTwo(
      Math.max(kInitialCapacity, initialCapacity)
    );

    this.#keys = new Int32Array(capacity).fill(kFreeKey);
    this.#values = new Uint32Array(capacity);
    this.#mask = capacity - 1;
    this.#shift = 32 - Math.log2(capacity);
    this.#growAt = growThreshold(capacity);
  }

  get size(): number {
    return this.#size;
  }

  /**
   * Number of slots to walk when iterating. Only non-negative `keys` entries
   * hold a voxel.
   */
  get capacity(): number {
    return this.#keys.length;
  }

  get keys(): Int32Array {
    return this.#keys;
  }

  get values(): Uint32Array {
    return this.#values;
  }

  #slotOf(
    key: number
  ): number {
    return Math.imul(key, kGoldenRatio) >>> this.#shift;
  }

  get(
    key: number
  ): PackedVoxel {
    const keys = this.#keys;
    const mask = this.#mask;
    let slot = this.#slotOf(key);

    for (;;) {
      const found = keys[slot];
      if (found === key) {
        return this.#values[slot];
      }
      if (found === kFreeKey) {
        return VOXEL_ABSENT;
      }
      slot = (slot + 1) & mask;
    }
  }

  has(
    key: number
  ): boolean {
    return this.get(key) !== VOXEL_ABSENT;
  }

  /**
   * Returns true when `key` was not already present.
   */
  set(
    key: number,
    value: PackedVoxel
  ): boolean {
    const keys = this.#keys;
    const mask = this.#mask;
    let slot = this.#slotOf(key);

    for (;;) {
      const found = keys[slot];
      if (found === key) {
        this.#values[slot] = value;

        return false;
      }
      if (found === kFreeKey) {
        break;
      }
      slot = (slot + 1) & mask;
    }

    keys[slot] = key;
    this.#values[slot] = value;
    this.#size++;
    if (this.#size >= this.#growAt) {
      this.#grow();
    }

    return true;
  }

  delete(
    key: number
  ): boolean {
    const keys = this.#keys;
    const mask = this.#mask;
    let hole = this.#slotOf(key);

    for (;;) {
      const found = keys[hole];
      if (found === key) {
        break;
      }
      if (found === kFreeKey) {
        return false;
      }
      hole = (hole + 1) & mask;
    }

    // Move following keys back to keep clusters contiguous.
    const values = this.#values;
    let scan = hole;
    for (;;) {
      scan = (scan + 1) & mask;
      const candidate = keys[scan];
      if (candidate === kFreeKey) {
        break;
      }

      const home = this.#slotOf(candidate);
      if (((scan - home) & mask) >= ((scan - hole) & mask)) {
        keys[hole] = candidate;
        values[hole] = values[scan];
        hole = scan;
      }
    }

    keys[hole] = kFreeKey;
    values[hole] = 0;
    this.#size--;

    return true;
  }

  clear(): void {
    this.#keys.fill(kFreeKey);
    this.#values.fill(0);
    this.#size = 0;
  }

  #grow(): void {
    const oldKeys = this.#keys;
    const oldValues = this.#values;
    const capacity = oldKeys.length * 2;

    this.#keys = new Int32Array(capacity).fill(kFreeKey);
    this.#values = new Uint32Array(capacity);
    this.#mask = capacity - 1;
    this.#shift = 32 - Math.log2(capacity);
    this.#growAt = growThreshold(capacity);

    const keys = this.#keys;
    const values = this.#values;
    for (let i = 0; i < oldKeys.length; i++) {
      const key = oldKeys[i];
      if (key === kFreeKey) {
        continue;
      }

      let slot = this.#slotOf(key);
      while (keys[slot] !== kFreeKey) {
        slot = (slot + 1) & this.#mask;
      }
      keys[slot] = key;
      values[slot] = oldValues[i];
    }
  }
}

function nextPowerOfTwo(
  value: number
): number {
  return 2 ** Math.ceil(Math.log2(value));
}

function growThreshold(
  capacity: number
): number {
  return ((capacity * kLoadFactorNum) / kLoadFactorDen) | 0;
}
