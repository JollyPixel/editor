// Import Internal Dependencies
import { CHUNK_SAMPLES } from "./ChunkCoord.ts";
import { TILE_SAMPLES } from "./TileCoord.ts";

// CONSTANTS
export const HOLE_QUADS = CHUNK_SAMPLES;
export const HOLE_BYTES = HOLE_QUADS * HOLE_QUADS / 8;
export const HOLE_TILE_QUADS = TILE_SAMPLES;
export const HOLE_TILE_BYTES = HOLE_TILE_QUADS * HOLE_TILE_QUADS / 8;
const kRowBytes = HOLE_QUADS / 8;
const kTileRowBytes = HOLE_TILE_QUADS / 8;

export class HoleMask {
  #bits: Uint8Array;

  constructor(
    bits: Uint8Array = new Uint8Array(HOLE_BYTES)
  ) {
    if (bits.length !== HOLE_BYTES) {
      throw new RangeError(`A hole mask needs ${HOLE_BYTES} bytes, got ${bits.length}.`);
    }

    this.#bits = bits.slice();
  }

  get empty(): boolean {
    return this.#bits.every((byte) => byte === 0);
  }

  isHole(
    quadX: number,
    quadZ: number
  ): boolean {
    const index = quadZ * HOLE_QUADS + quadX;

    return (this.#bits[index >> 3] & (1 << (index & 7))) !== 0;
  }

  load(
    bits: Uint8Array
  ): void {
    if (bits.length !== HOLE_BYTES) {
      throw new RangeError(`A hole mask needs ${HOLE_BYTES} bytes, got ${bits.length}.`);
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
      const start = tileRowStart(tileX, tileZ, row);
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
        tileRowStart(tileX, tileZ, row)
      );
    }
  }
}

function tileRowStart(
  tileX: number,
  tileZ: number,
  row: number
): number {
  return (tileZ * HOLE_TILE_QUADS + row) * kRowBytes + tileX * kTileRowBytes;
}
