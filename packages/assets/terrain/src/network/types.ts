// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import type {
  chunkEntrySchema,
  terrainCommandSchema,
  terrainManifestSchema,
  tilePatchSchema
} from "./TerrainCommand.schema.ts";

export type EncodedTilePatch = network.Infer<typeof tilePatchSchema>;
export type ChunkEntry = network.Infer<typeof chunkEntrySchema>;
export type TerrainManifest = network.Infer<typeof terrainManifestSchema>;
export type TerrainSnapshot = TerrainManifest;

export type TerrainCommand = network.Infer<typeof terrainCommandSchema>;
export type TerrainCommandAction = TerrainCommand["action"];
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
