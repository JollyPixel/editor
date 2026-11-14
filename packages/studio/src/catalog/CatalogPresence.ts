// Import Third-party Dependencies
import type {
  PresenceChannel,
  Room
} from "@jolly-pixel/network/client";
import {
  openAssets,
  type OpenAssets
} from "@jolly-pixel/server";
import { openAssetsChannel } from "@jolly-pixel/server/client";
import { toPresencePeer } from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import {
  AssetOccupancy,
  type AssetVisit
} from "./AssetOccupancy.ts";

// CONSTANTS
export const CATALOG_PRESENCE_CHANGE = "change";

export class CatalogPresence extends EventTarget implements Disposable {
  #room: Room;
  #channel: PresenceChannel<OpenAssets>;
  #occupancy = AssetOccupancy.EMPTY;

  constructor(
    room: Room
  ) {
    super();
    this.#room = room;
    this.#channel = openAssetsChannel(room);
    this.#channel.on("change", this.#refresh);
    room.on("peer-profile", this.#refresh);
    this.#refresh();
  }

  get occupancy(): AssetOccupancy {
    return this.#occupancy;
  }

  showTabs(
    assetIds: readonly string[],
    active: string
  ): void {
    this.#channel.publish(
      openAssets(assetIds, assetIds.includes(active) ? active : null)
    );
  }

  dispose(): void {
    this.#channel.off("change", this.#refresh);
    this.#room.off("peer-profile", this.#refresh);
    this.#channel.destroy();
  }

  [Symbol.dispose](): void {
    this.dispose();
  }

  readonly #refresh = (): void => {
    const visits: AssetVisit[] = [];
    for (const [clientId, assets] of this.#channel.values) {
      const member = this.#room.peers.get(clientId);
      if (member !== undefined) {
        visits.push([toPresencePeer(member), assets]);
      }
    }
    this.#occupancy = new AssetOccupancy(visits);
    this.dispatchEvent(new Event(CATALOG_PRESENCE_CHANGE));
  };
}
