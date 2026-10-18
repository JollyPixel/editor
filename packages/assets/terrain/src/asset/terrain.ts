// Import Third-party Dependencies
import type { Infer } from "@jolly-pixel/network";
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server";
import * as z from "zod/mini";

// Import Internal Dependencies
import { terrainSnapshotSchema } from "../network/TerrainCommand.schema.ts";
import { TERRAIN_ICON } from "./icons.ts";

// CONSTANTS
export const TERRAIN_KIND = "terrain";
export const TERRAIN_COMMAND = "terrain.command";
export const TERRAIN_EXTENSION = ".terrain.json";
export const TERRAIN_DOCUMENT_VERSION = 1;

export const TERRAIN_ASSET: AssetKindDescriptor = {
  kind: TERRAIN_KIND,
  label: "Terrain",
  extension: TERRAIN_EXTENSION,
  icon: TERRAIN_ICON
};

export const terrainAssetDocumentSchema = z.extend(terrainSnapshotSchema, {
  version: z.literal(TERRAIN_DOCUMENT_VERSION)
});

export type TerrainAssetDocument = Infer<typeof terrainAssetDocumentSchema>;

export function encodeTerrainAssetDocument(
  document: TerrainAssetDocument
): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(document));
}
