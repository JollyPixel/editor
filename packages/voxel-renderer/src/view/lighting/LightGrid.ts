// Import Internal Dependencies
import type { VoxelCoord } from "../../document/world/types.ts";

// CONSTANTS
const kKeyBias = 2 ** 15;
const kKeySpan = 2 ** 16;

export type LightChunkKey = number;

export interface VoxelChunkCoords {
  cx: number;
  cy: number;
  cz: number;
}

export type LightChunkCoords = readonly [cx: number, cy: number, cz: number];

export function lightChunkKey(
  cx: number,
  cy: number,
  cz: number
): LightChunkKey {
  return ((((cx + kKeyBias) * kKeySpan) + cy + kKeyBias) * kKeySpan) +
    cz + kKeyBias;
}

export function lightChunkCoords(
  key: LightChunkKey
): LightChunkCoords {
  const rest = Math.floor(key / kKeySpan);

  return [
    Math.floor(rest / kKeySpan) - kKeyBias,
    (rest % kKeySpan) - kKeyBias,
    (key % kKeySpan) - kKeyBias
  ];
}

export class LightGrid {
  readonly size: number;
  readonly shift: number;
  readonly mask: number;

  constructor(
    size: number
  ) {
    this.size = size;
    this.shift = Math.log2(size);
    this.mask = size - 1;
  }

  get cells(): number {
    return this.size ** 3;
  }

  localIndex(
    x: number,
    y: number,
    z: number
  ): number {
    const shift = this.shift;

    return x | (y << shift) | (z << (shift * 2));
  }

  worldIndex(
    x: number,
    y: number,
    z: number
  ): number {
    const mask = this.mask;

    return this.localIndex(x & mask, y & mask, z & mask);
  }

  * chunksCovering(
    minX: number,
    minY: number,
    minZ: number,
    span: number
  ): IterableIterator<LightChunkCoords> {
    const shift = this.shift;
    const last = span - 1;

    for (let cz = minZ >> shift; cz <= (minZ + last) >> shift; cz++) {
      for (let cy = minY >> shift; cy <= (minY + last) >> shift; cy++) {
        for (let cx = minX >> shift; cx <= (minX + last) >> shift; cx++) {
          yield [cx, cy, cz];
        }
      }
    }
  }

  someKeyCovering(
    minX: number,
    minY: number,
    minZ: number,
    span: number,
    test: (key: LightChunkKey) => boolean
  ): boolean {
    const shift = this.shift;
    const last = span - 1;
    const maxX = (minX + last) >> shift;
    const maxY = (minY + last) >> shift;
    const maxZ = (minZ + last) >> shift;

    for (let cz = minZ >> shift; cz <= maxZ; cz++) {
      for (let cy = minY >> shift; cy <= maxY; cy++) {
        for (let cx = minX >> shift; cx <= maxX; cx++) {
          if (test(lightChunkKey(cx, cy, cz))) {
            return true;
          }
        }
      }
    }

    return false;
  }

  * keysCovering(
    minX: number,
    minY: number,
    minZ: number,
    span: number
  ): IterableIterator<LightChunkKey> {
    for (const [cx, cy, cz] of this.chunksCovering(minX, minY, minZ, span)) {
      yield lightChunkKey(cx, cy, cz);
    }
  }

  keysUnder(
    chunk: Readonly<VoxelChunkCoords>,
    offset: Readonly<VoxelCoord>
  ): IterableIterator<LightChunkKey> {
    const { size } = this;

    return this.keysCovering(
      (chunk.cx * size) + offset.x,
      (chunk.cy * size) + offset.y,
      (chunk.cz * size) + offset.z,
      size
    );
  }
}
