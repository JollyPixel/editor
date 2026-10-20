// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import { ChunkCoord } from "@jolly-pixel/terrain.renderer";
import * as z from "zod/mini";

// CONSTANTS
export const DEFAULT_PRESENCE_RADIUS = 4;
export const MAX_PRESENCE_RADIUS = 16;

const kPresenceRadius = z.int().check(z.gte(0), z.lte(MAX_PRESENCE_RADIUS));

export const terrainInterestSchema = z.object({
  x: z.int(),
  z: z.int(),
  radius: kPresenceRadius
});

export type TerrainInterestJSON = network.Infer<typeof terrainInterestSchema>;

export class TerrainInterest {
  static parse(
    value: unknown
  ): TerrainInterest | undefined {
    const result = z.safeParse(terrainInterestSchema, value);

    return result.success ? TerrainInterest.fromJSON(result.data) : undefined;
  }

  static fromJSON(
    json: TerrainInterestJSON
  ): TerrainInterest {
    return new TerrainInterest(new ChunkCoord(json.x, json.z), json.radius);
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
    if (!z.safeParse(kPresenceRadius, radius).success) {
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
