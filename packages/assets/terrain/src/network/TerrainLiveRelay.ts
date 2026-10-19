// Import Third-party Dependencies
import type { AssetRelay } from "@jolly-pixel/asset-server";
import type { RoomBroadcast } from "@jolly-pixel/network";
import { ChunkCoord } from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  TERRAIN_INTEREST_CHANGED,
  TERRAIN_LIVE_PATCHED,
  TERRAIN_RELAY_SCHEMAS,
  type PeerLivePatchedMessage,
  type TerrainLiveMessage
} from "./TerrainLive.schema.ts";
import { TerrainInterest } from "./TerrainInterest.ts";

export class TerrainLiveRelay implements AssetRelay {
  readonly schemas = TERRAIN_RELAY_SCHEMAS;

  #interests = new Map<string, TerrainInterest>();

  receive(
    clientId: string,
    message: unknown,
    room: RoomBroadcast
  ): void {
    const live = message as TerrainLiveMessage;
    if (live.action === TERRAIN_INTEREST_CHANGED) {
      this.#interests.set(
        clientId,
        new TerrainInterest(new ChunkCoord(live.x, live.z), live.radius)
      );

      return;
    }

    const forwarded: PeerLivePatchedMessage = {
      type: TERRAIN_LIVE_PATCHED,
      from: clientId,
      tiles: live.tiles
    };
    for (const [peerId, interest] of this.#interests) {
      if (peerId !== clientId && interest.overlaps(live.tiles)) {
        room.sendTo(peerId, forwarded);
      }
    }
  }

  leave(
    clientId: string
  ): void {
    this.#interests.delete(clientId);
  }
}
