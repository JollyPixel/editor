// Import Third-party Dependencies
import {
  PresenceChannel,
  type PresenceChange,
  type Room
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type { PeerSelectionRegistry } from "../selection/peer/PeerSelectionRegistry.ts";
import type { SelectionManager } from "../selection/SelectionManager.ts";

// CONSTANTS
const kDefaultPresenceKey = "selection";

export type PeerSelectionId = string | null;

export interface PeerSelectionSyncOptions {
  room: Room;
  registry: PeerSelectionRegistry;
  selection: SelectionManager;
  presenceKey?: string;
}

export class PeerSelectionSync {
  #channel: PresenceChannel<PeerSelectionId>;
  #registry: PeerSelectionRegistry;
  #selection: SelectionManager;

  #onPeerChange = (
    change: PresenceChange<PeerSelectionId>
  ): void => {
    if (change.value === undefined) {
      this.#registry.removePeer(change.clientId);
    }
    else {
      this.#registry.select(change.clientId, change.value);
    }
  };

  #onLocalSelectionChange = (): void => {
    this.#channel.publish(this.#selection.selected);
  };

  constructor(
    options: PeerSelectionSyncOptions
  ) {
    this.#registry = options.registry;
    this.#selection = options.selection;
    this.#channel = new PresenceChannel(options.room, {
      key: options.presenceKey ?? kDefaultPresenceKey,
      decode: decodePeerSelectionId
    });

    for (const [clientId, objectId] of this.#channel.values) {
      this.#registry.select(clientId, objectId);
    }
    this.#channel.on("change", this.#onPeerChange);
    this.#selection.addEventListener("selectionChange", this.#onLocalSelectionChange);
    this.#channel.publish(this.#selection.selected);
  }

  destroy(): void {
    this.#selection.removeEventListener("selectionChange", this.#onLocalSelectionChange);
    this.#channel.destroy();
  }
}

export function decodePeerSelectionId(
  value: unknown
): PeerSelectionId | undefined {
  if (value === null || typeof value === "string") {
    return value;
  }

  return undefined;
}
