// Import Third-party Dependencies
import {
  PEER_ACTIVITY_KEY,
  peerActivitySchema,
  type PeerActivity
} from "@jolly-pixel/network";
import type { Room } from "@jolly-pixel/network/client";
import type { AgentChatClient } from "@jolly-pixel/server/client";

// Import Internal Dependencies
import type { GolemAsset } from "../assets/GolemAsset.ts";

export type AssetRoomLookup = (asset: GolemAsset) => Room;

export class ActivityMirror {
  #chat: AgentChatClient;
  #room: AssetRoomLookup;
  #current: GolemAsset | null = null;

  constructor(
    chat: AgentChatClient,
    room: AssetRoomLookup
  ) {
    this.#chat = chat;
    this.#room = room;
  }

  show(
    asset: GolemAsset,
    activity: PeerActivity
  ): void {
    const value = peerActivitySchema.parse(activity);
    if (this.#current !== null && this.#current !== asset) {
      this.#publish(this.#current, null);
    }
    this.#publish(asset, value);
    this.#chat.publishActivity({
      ...value,
      assetId: asset.id
    });
    this.#current = asset;
  }

  clear(): void {
    if (this.#current !== null) {
      this.#publish(this.#current, null);
    }
    this.#current = null;
    this.#chat.publishActivity(null);
  }

  forget(
    asset: GolemAsset
  ): void {
    if (this.#current === asset) {
      this.#current = null;
      this.#chat.publishActivity(null);
    }
  }

  #publish(
    asset: GolemAsset,
    activity: PeerActivity | null
  ): void {
    this.#room(asset).updatePresence({
      [PEER_ACTIVITY_KEY]: activity
    });
  }
}
