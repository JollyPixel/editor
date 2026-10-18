// Import Third-party Dependencies
import { ChunkCoord } from "@jolly-pixel/terrain.renderer";
import * as z from "zod/mini";

// CONSTANTS
export const TERRAIN_INTEREST_KEY = "terrain-interest";
export const DEFAULT_PRESENCE_RADIUS = 4;
export const MAX_PRESENCE_RADIUS = 16;

const kInterestSchema = z.object({
  x: z.int(),
  z: z.int(),
  radius: z.int().check(z.gte(0), z.lte(MAX_PRESENCE_RADIUS))
});

export interface TerrainInterestJSON {
  x: number;
  z: number;
  radius: number;
}

export class TerrainInterest {
  static parse(
    value: unknown
  ): TerrainInterest | undefined {
    const result = z.safeParse(kInterestSchema, value);

    return result.success ?
      new TerrainInterest(new ChunkCoord(result.data.x, result.data.z), result.data.radius) :
      undefined;
  }

  static around(
    sampleX: number,
    sampleZ: number,
    radius = DEFAULT_PRESENCE_RADIUS
  ): TerrainInterest {
    return new TerrainInterest(ChunkCoord.containing(sampleX, sampleZ), radius);
  }

  readonly centre: ChunkCoord;
  readonly radius: number;

  constructor(
    centre: ChunkCoord,
    radius: number
  ) {
    if (!Number.isSafeInteger(radius) || radius < 0 || radius > MAX_PRESENCE_RADIUS) {
      throw new RangeError(
        `Presence radius must be an integer from 0 to ${MAX_PRESENCE_RADIUS}, got ${radius}.`
      );
    }

    this.centre = centre;
    this.radius = radius;
  }

  contains(
    chunk: Pick<ChunkCoord, "x" | "z">
  ): boolean {
    return Math.abs(chunk.x - this.centre.x) <= this.radius &&
      Math.abs(chunk.z - this.centre.z) <= this.radius;
  }

  containsSample(
    sampleX: number,
    sampleZ: number
  ): boolean {
    return this.contains(ChunkCoord.containing(sampleX, sampleZ));
  }

  overlaps(
    chunks: Iterable<Pick<ChunkCoord, "x" | "z">>
  ): boolean {
    for (const chunk of chunks) {
      if (this.contains(chunk)) {
        return true;
      }
    }

    return false;
  }

  equals(
    other: TerrainInterest | undefined
  ): boolean {
    return other !== undefined &&
      this.radius === other.radius &&
      this.centre.equals(other.centre);
  }

  toJSON(): TerrainInterestJSON {
    return {
      x: this.centre.x,
      z: this.centre.z,
      radius: this.radius
    };
  }
}
