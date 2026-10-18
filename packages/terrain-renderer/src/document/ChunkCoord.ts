// CONSTANTS
export const CHUNK_SAMPLES = 64;

export type ChunkKey = `${number},${number}`;

export class ChunkCoord {
  readonly x: number;
  readonly z: number;

  static containing(
    sampleX: number,
    sampleZ: number
  ): ChunkCoord {
    return new ChunkCoord(
      Math.floor(sampleX / CHUNK_SAMPLES),
      Math.floor(sampleZ / CHUNK_SAMPLES)
    );
  }

  constructor(
    x: number,
    z: number
  ) {
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(z)) {
      throw new RangeError(`Chunk coordinates must be integers, got (${x}, ${z}).`);
    }

    this.x = x;
    this.z = z;
  }

  get key(): ChunkKey {
    return `${this.x},${this.z}`;
  }

  get originSample(): { x: number; z: number; } {
    return {
      x: this.x * CHUNK_SAMPLES,
      z: this.z * CHUNK_SAMPLES
    };
  }

  neighbours(): ChunkCoord[] {
    return [
      new ChunkCoord(this.x - 1, this.z),
      new ChunkCoord(this.x + 1, this.z),
      new ChunkCoord(this.x, this.z - 1),
      new ChunkCoord(this.x, this.z + 1)
    ];
  }

  equals(
    other: ChunkCoord
  ): boolean {
    return this.x === other.x && this.z === other.z;
  }
}
