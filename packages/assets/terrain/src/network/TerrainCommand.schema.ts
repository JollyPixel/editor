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
export const CHUNK_TILE_COUNT = TILES_PER_CHUNK * TILES_PER_CHUNK;
const kChunkCoordinate = z.int();

export const tilePatchSchema = z.object({
  x: kChunkCoordinate,
  z: kChunkCoordinate,
  tile: z.int().check(z.gte(0), z.lt(CHUNK_TILE_COUNT)),
  heights: z.string()
});

export const tilePatchesSchema = z.array(tilePatchSchema).check(
  z.minLength(1),
  z.maxLength(MAX_PATCH_TILES)
);

export const chunkEntrySchema = z.object({
  x: kChunkCoordinate,
  z: kChunkCoordinate,
  overview: z.optional(z.string()),
  heights: z.optional(z.string())
});

export const terrainManifestSchema = z.object({
  chunks: z.array(chunkEntrySchema)
});

export const terrainPartSchema = z.string();

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
    tiles: tilePatchesSchema
  })
]);

export const terrainCommandProtocol: MessageProtocol = new MessageProtocol(
  z.union(terrainCommandSchema.def.options.map(withCommandHeader))
);
