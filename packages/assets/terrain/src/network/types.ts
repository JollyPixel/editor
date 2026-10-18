// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import type {
  chunkSnapshotSchema,
  terrainCommandSchema,
  terrainSnapshotSchema
} from "./TerrainCommand.schema.ts";

export type ChunkSnapshot = network.Infer<typeof chunkSnapshotSchema>;
export type TerrainSnapshot = network.Infer<typeof terrainSnapshotSchema>;

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
