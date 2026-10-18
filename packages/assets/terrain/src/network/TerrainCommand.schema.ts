// Import Third-party Dependencies
import {
  commandVariant,
  MessageProtocol,
  withCommandHeader
} from "@jolly-pixel/network";
import * as z from "zod/mini";

// CONSTANTS
const kChunkCoordinate = z.int();

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
  })
]);

export const terrainCommandProtocol: MessageProtocol = new MessageProtocol(
  z.union(terrainCommandSchema.def.options.map(withCommandHeader))
);
