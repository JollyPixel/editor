// Import Third-party Dependencies
import type { Infer } from "@jolly-pixel/network";
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server";
import * as z from "zod/mini";

// Import Internal Dependencies
import { terrainManifestSchema } from "../network/TerrainCommand.schema.ts";
import { TERRAIN_ICON } from "./icons.ts";

// CONSTANTS
export const TERRAIN_KIND = "terrain";
export const TERRAIN_COMMAND = "terrain.command";
export const TERRAIN_EXTENSION = ".terrain.json";
export const TERRAIN_FILE_VERSION = 1;

export const TERRAIN_ASSET: AssetKindDescriptor = {
  kind: TERRAIN_KIND,
  label: "Terrain",
  extension: TERRAIN_EXTENSION,
  icon: TERRAIN_ICON
};

export const terrainFileSchema = z.extend(terrainManifestSchema, {
  version: z.literal(TERRAIN_FILE_VERSION)
});

export type TerrainFile = Infer<typeof terrainFileSchema>;

export function encodeTerrainFile(
  file: TerrainFile
): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(file));
}
