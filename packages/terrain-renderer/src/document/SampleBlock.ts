// Import Internal Dependencies
import {
  CHUNK_SAMPLES,
  ChunkCoord
} from "./ChunkCoord.ts";
import type {
  HeightRange,
  TerrainChunk
} from "./TerrainChunk.ts";
import type { TerrainReader } from "./TerrainDocument.ts";

// CONSTANTS
export const BORDER_SAMPLES = 2;
const kFarBorder = CHUNK_SAMPLES - BORDER_SAMPLES;
const kMaxBorderSteps = BORDER_SAMPLES * 4;
const kNeighbourOrder = [
  [-1, 0],
  [0, -1],
  [-1, -1],
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
  [-1, 1]
] as const;
const kDown = [0, -1] as const;
const kRight = [1, 0] as const;
const kUp = [0, 1] as const;
const kLeft = [-1, 0] as const;

type Step = readonly [number, number];

export class SampleBlock {
  readonly coord: ChunkCoord;

  #own: TerrainChunk | undefined;
  #area: (TerrainChunk | undefined)[] = [];
  #sources: TerrainChunk[] = [];
  #heightRange: HeightRange | null | undefined;

  constructor(
    terrain: Pick<TerrainReader, "chunk">,
    coord: ChunkCoord
  ) {
    this.coord = coord;
    this.#own = terrain.chunk(coord);
    if (this.#own !== undefined) {
      this.#sources = [this.#own];

      return;
    }

    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        this.#area.push(terrain.chunk(new ChunkCoord(coord.x + dx, coord.z + dz)));
      }
    }
    for (const [dx, dz] of kNeighbourOrder) {
      const neighbour = this.#chunkAt(dx, dz);
      if (neighbour !== undefined) {
        this.#sources.push(neighbour);
      }
    }
  }

  get heightRange(): HeightRange | null {
    if (this.#heightRange === undefined) {
      this.#heightRange = unionRange(this.#sources);
    }

    return this.#heightRange;
  }

  height(
    sampleX: number,
    sampleZ: number
  ): number {
    if (this.#own !== undefined) {
      return this.#own.nearestHeight(sampleX, sampleZ);
    }

    return this.#borderHeight(sampleX, sampleZ) ??
      this.#nearestHeight(sampleX, sampleZ);
  }

  #borderHeight(
    sampleX: number,
    sampleZ: number
  ): number | undefined {
    const origin = this.coord.originSample;
    let x = sampleX - origin.x;
    let z = sampleZ - origin.z;
    for (let step = 0; step <= kMaxBorderSteps; step++) {
      const blockX = Math.floor(x / CHUNK_SAMPLES);
      const blockZ = Math.floor(z / CHUNK_SAMPLES);
      if (Math.abs(blockX) > 1 || Math.abs(blockZ) > 1) {
        return undefined;
      }

      const localX = x - blockX * CHUNK_SAMPLES;
      const localZ = z - blockZ * CHUNK_SAMPLES;
      const chunk = this.#chunkAt(blockX, blockZ);
      if (chunk !== undefined) {
        return chunk.height(localX, localZ);
      }

      const direction = borderStep(localX, localZ);
      if (direction === null) {
        return undefined;
      }
      x += direction[0];
      z += direction[1];
    }

    return undefined;
  }

  #nearestHeight(
    sampleX: number,
    sampleZ: number
  ): number {
    let nearest = this.#sources[0];
    if (nearest === undefined) {
      return 0;
    }

    let nearestDistance = Infinity;
    for (const source of this.#sources) {
      const distance = source.squaredDistanceTo(sampleX, sampleZ);
      if (distance < nearestDistance) {
        nearest = source;
        nearestDistance = distance;
      }
    }

    return nearest.nearestHeight(sampleX, sampleZ);
  }

  #chunkAt(
    dx: number,
    dz: number
  ): TerrainChunk | undefined {
    return this.#area[(dz + 1) * 3 + dx + 1];
  }
}

function borderStep(
  localX: number,
  localZ: number
): Step | null {
  if (localZ < BORDER_SAMPLES && localX < kFarBorder) {
    return kDown;
  }
  if (localX >= kFarBorder && localZ < kFarBorder) {
    return kRight;
  }
  if (localZ >= kFarBorder && localX >= BORDER_SAMPLES) {
    return kUp;
  }
  if (localX < BORDER_SAMPLES && localZ >= BORDER_SAMPLES) {
    return kLeft;
  }

  return null;
}

function unionRange(
  sources: readonly TerrainChunk[]
): HeightRange | null {
  if (sources.length === 0) {
    return null;
  }

  let min = Infinity;
  let max = -Infinity;
  for (const { heightRange } of sources) {
    min = Math.min(min, heightRange.min);
    max = Math.max(max, heightRange.max);
  }

  return { min, max };
}
