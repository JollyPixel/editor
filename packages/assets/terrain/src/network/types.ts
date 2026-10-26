// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import type {
  chunkEntrySchema,
  layerPropertiesSchema,
  terrainCommandSchema,
  terrainLayerSchema,
  terrainManifestSchema,
  TERRAIN_TEXTURE_SIZES,
  tilePatchSchema
} from "./TerrainCommand.schema.ts";

export type EncodedTilePatch = network.Infer<typeof tilePatchSchema>;
export type ChunkEntry = network.Infer<typeof chunkEntrySchema>;
export type TerrainManifest = network.Infer<typeof terrainManifestSchema>;
export type TerrainSnapshot = TerrainManifest;

export type TerrainTextureSize = typeof TERRAIN_TEXTURE_SIZES[number];
export type TerrainLayerProperties = network.Infer<typeof layerPropertiesSchema>;
export type TerrainLayerData = network.Infer<typeof terrainLayerSchema>;
export type TerrainLayerChanges = Partial<TerrainLayerProperties>;
export type TerrainLayerField = keyof TerrainLayerProperties;
export type TerrainLayerMap = NonNullable<TerrainLayerProperties["albedo"]>;

export type TerrainCommand = network.Infer<typeof terrainCommandSchema>;
export type TerrainCommandAction = TerrainCommand["action"];
export type TerrainLayerCommand = Extract<
  TerrainCommand,
  {
    action:
      | "layer-added"
      | "layer-updated"
      | "layer-removed"
      | "texture-size-changed";
  }
>;
export type TerrainChunkCommand = Exclude<TerrainCommand, TerrainLayerCommand>;
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
