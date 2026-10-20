// Import Third-party Dependencies
import type { AssetRelay } from "@jolly-pixel/asset-server";
import type { RoomBroadcast } from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  TERRAIN_INTEREST_CHANGED,
  TERRAIN_LIVE_PATCHED,
  type PeerLivePatchedMessage,
  type TerrainLiveMessage
} from "./TerrainLive.schema.ts";
import { TerrainInterest } from "./TerrainInterest.ts";

export class TerrainLiveRelay implements AssetRelay<TerrainLiveMessage> {
  #interests = new Map<string, TerrainInterest>();

  receive(
    clientId: string,
    message: TerrainLiveMessage,
    room: RoomBroadcast
  ): void {
    if (message.action === TERRAIN_INTEREST_CHANGED) {
      this.#interests.set(clientId, TerrainInterest.fromJSON(message));

      return;
    }

    const forwarded: PeerLivePatchedMessage = {
      type: TERRAIN_LIVE_PATCHED,
      from: clientId,
      tiles: message.tiles
    };
    for (const [peerId, interest] of this.#interests) {
      if (peerId !== clientId && interest.overlaps(message.tiles)) {
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
