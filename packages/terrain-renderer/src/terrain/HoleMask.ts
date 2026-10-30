// Import Internal Dependencies
import {
  CHUNK_TIERS,
  chunkResolution,
  type ChunkTier
} from "./chunkTier.ts";
import { TILE_SAMPLES } from "./TileCoord.ts";

// CONSTANTS
export const HOLE_QUADS = chunkResolution(1);
export const HOLE_BYTES = holeBytes(1);
export const HOLE_TILE_QUADS = TILE_SAMPLES;
export const HOLE_TILE_BYTES = HOLE_TILE_QUADS * HOLE_TILE_QUADS / 8;
const kTileRowBytes = HOLE_TILE_QUADS / 8;

export function holeBytes(
  tier: ChunkTier
): number {
  return chunkResolution(tier) ** 2 / 8;
}

export function tierOfHoleBytes(
  bytes: number
): ChunkTier | null {
  return CHUNK_TIERS.find((tier) => holeBytes(tier) === bytes) ?? null;
}

export class HoleMask {
  readonly tier: ChunkTier;
  readonly quads: number;

  #bits: Uint8Array;

  static empty(
    tier: ChunkTier
  ): HoleMask {
    return new HoleMask(new Uint8Array(holeBytes(tier)));
  }

  constructor(
    bits: Uint8Array = new Uint8Array(HOLE_BYTES)
  ) {
    const tier = tierOfHoleBytes(bits.length);
    if (tier === null) {
      throw new RangeError(
        `A hole mask needs ${CHUNK_TIERS.map(holeBytes).join(", ")} bytes, got ${bits.length}.`
      );
    }

    this.tier = tier;
    this.quads = chunkResolution(tier);
    this.#bits = bits.slice();
  }

  get empty(): boolean {
    return this.#bits.every((byte) => byte === 0);
  }

  isHole(
    quadX: number,
    quadZ: number
  ): boolean {
    const index = quadZ * this.quads + quadX;

    return (this.#bits[index >> 3] & (1 << (index & 7))) !== 0;
  }

  load(
    bits: Uint8Array
  ): void {
    if (bits.length !== this.#bits.length) {
      throw new RangeError(
        `A hole mask at x${this.tier} needs ${this.#bits.length} bytes, got ${bits.length}.`
      );
    }

    this.#bits.set(bits);
  }

  copy(): Uint8Array {
    return this.#bits.slice();
  }

  tile(
    tileX: number,
    tileZ: number
  ): Uint8Array {
    const bits = new Uint8Array(HOLE_TILE_BYTES);
    for (let row = 0; row < HOLE_TILE_QUADS; row++) {
      const start = this.#tileRowStart(tileX, tileZ, row);
      bits.set(this.#bits.subarray(start, start + kTileRowBytes), row * kTileRowBytes);
    }

    return bits;
  }

  writeTile(
    tileX: number,
    tileZ: number,
    bits: Uint8Array
  ): void {
    if (bits.length !== HOLE_TILE_BYTES) {
      throw new RangeError(
        `Hole tile ${tileX},${tileZ} needs ${HOLE_TILE_BYTES} bytes, got ${bits.length}.`
      );
    }

    for (let row = 0; row < HOLE_TILE_QUADS; row++) {
      this.#bits.set(
        bits.subarray(row * kTileRowBytes, (row + 1) * kTileRowBytes),
        this.#tileRowStart(tileX, tileZ, row)
      );
    }
  }

  #tileRowStart(
    tileX: number,
    tileZ: number,
    row: number
  ): number {
    return (tileZ * HOLE_TILE_QUADS + row) * (this.quads / 8) + tileX * kTileRowBytes;
  }
}
