// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";
import { CATALOG_ROOM } from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import { SessionConnection } from "#src/session/SessionConnection.ts";
import {
  FakeClient,
  record,
  snapshotMessage
} from "../rooms.ts";

// CONSTANTS
export const PEER_IDENTITY = {
  username: "alice",
  peerId: "peer-alice",
  color: "#ff0000"
};
export const MAP = record("map", "voxelmap");
export const GRASS = record("grass", "pixelart");
export const STONE = record("stone", "pixelart");
export const SOUND = record("sound", "audio");

export interface FakeConnectionOptions {
  dependencies?: Record<string, AssetReferenceData[]>;
}

export async function fakeConnection(
  options: FakeConnectionOptions = {}
) {
  const client = new FakeClient();
  const connecting = SessionConnection.connect({
    identity: PEER_IDENTITY,
    client
  });
  client.fakeRoom(CATALOG_ROOM).receive(snapshotMessage(
    [MAP, GRASS, STONE, SOUND],
    options.dependencies ?? {}
  ));

  return {
    client,
    connection: await connecting
  };
}
