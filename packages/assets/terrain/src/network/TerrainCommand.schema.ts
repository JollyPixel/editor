// Import Third-party Dependencies
import {
  commandVariant,
  MessageProtocol,
  withCommandHeader
} from "@jolly-pixel/network";
import { TILES_PER_CHUNK } from "@jolly-pixel/terrain.renderer";
import * as z from "zod/mini";

// CONSTANTS
export const MAX_PATCH_TILES = 1024;
const kChunkCoordinate = z.int();

export const tilePatchSchema = z.object({
  x: kChunkCoordinate,
  z: kChunkCoordinate,
  tile: z.int().check(z.gte(0), z.lt(TILES_PER_CHUNK * TILES_PER_CHUNK)),
  heights: z.string()
});

export const chunkSnapshotSchema = z.object({
  x: kChunkCoordinate,
  z: kChunkCoordinate,
  heights: z.string()
});

export const terrainSnapshotSchema = z.object({
  chunks: z.array(chunkSnapshotSchema)
});

export const terrainCommandSchema = z.discriminatedUnion("action", [
  commandVariant("chunk-added", {
    x: kChunkCoordinate,
    z: kChunkCoordinate,
    heights: z.string()
  }),
  commandVariant("chunk-removed", {
    x: kChunkCoordinate,
    z: kChunkCoordinate
  }),
  commandVariant("heights-patched", {
    tiles: z.array(tilePatchSchema).check(z.minLength(1), z.maxLength(MAX_PATCH_TILES))
  })
]);

export const terrainCommandProtocol: MessageProtocol = new MessageProtocol(
  z.union(terrainCommandSchema.def.options.map(withCommandHeader))
);
