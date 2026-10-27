// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import type {
  chunkEntrySchema,
  materialPropertiesSchema,
  splatTilePatchSchema,
  terrainCommandSchema,
  terrainManifestSchema,
  terrainMaterialSchema,
  TERRAIN_TEXTURE_SIZES,
  tilePatchSchema
} from "./TerrainCommand.schema.ts";

export type EncodedTilePatch = network.Infer<typeof tilePatchSchema>;
export type EncodedSplatTilePatch = network.Infer<typeof splatTilePatchSchema>;
export type ChunkEntry = network.Infer<typeof chunkEntrySchema>;
export type TerrainManifest = network.Infer<typeof terrainManifestSchema>;
export type TerrainSnapshot = TerrainManifest;

export type TerrainTextureSize = typeof TERRAIN_TEXTURE_SIZES[number];
export type TerrainMaterialProperties = network.Infer<typeof materialPropertiesSchema>;
export type TerrainMaterialData = network.Infer<typeof terrainMaterialSchema>;
export type TerrainMaterialChanges = Partial<TerrainMaterialProperties>;
export type TerrainMaterialField = keyof TerrainMaterialProperties;
export type TerrainMaterialMap = NonNullable<TerrainMaterialProperties["albedo"]>;

export type TerrainCommand = network.Infer<typeof terrainCommandSchema>;
export type TerrainCommandAction = TerrainCommand["action"];
export type TerrainMaterialCommand = Extract<
  TerrainCommand,
  {
    action:
      | "material-added"
      | "material-updated"
      | "material-removed"
      | "texture-size-changed";
  }
>;
export type TerrainChunkCommand = Exclude<TerrainCommand, TerrainMaterialCommand>;
export type TerrainNetworkCommand = TerrainCommand & network.NetworkCommandHeader;

export type TerrainServerMessage = network.NetworkServerMessage<
  TerrainNetworkCommand,
  TerrainSnapshot,
  AssetRoomNotice
>;

export type TerrainRoom = network.Room<
  TerrainNetworkCommand,
  TerrainServerMessage
>;
