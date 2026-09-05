// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type { PeerSelectionRegistry } from "../selection/peer/PeerSelectionRegistry.ts";
import type { SelectionManager } from "../selection/SelectionManager.ts";

// CONSTANTS
const kDefaultPresenceKey = "selection";
const kDefaultResyncIntervalMs = 5_000;

export type PeerSelectionId = string | null;

export interface PeerSelectionSyncOptions<
  ClientMessage = unknown,
  ServerMessage = unknown
> {
  room: network.Room<ClientMessage, ServerMessage>;
  registry: PeerSelectionRegistry;
  selection: SelectionManager;
  /**
   * Presence field for selection ids.
   * @default "selection"
   */
  presenceKey?: string;
  /**
   * Milliseconds between reconciliations with `room.peers`. `0` disables them.
   * @default 5000
   */
  resyncIntervalMs?: number;
}

/**
 * Syncs local and remote selection ids through room presence.
 */
export class PeerSelectionSync<
  ClientMessage = unknown,
  ServerMessage = unknown
> {
  #room: network.Room<ClientMessage, ServerMessage>;
  #registry: PeerSelectionRegistry;
  #selection: SelectionManager;
  #presenceKey: string;
  // Limit cleanup to peers applied by this instance.
  #knownPeers = new Set<string>();
  #resyncTimer: ReturnType<typeof setInterval> | null = null;

  #onSync = (
    event: network.RoomSyncEvent
  ): void => {
    for (const clientId of event.clientIds) {
      this.#syncPeer(clientId);
    }
  };
  #onPeerJoined = (
    event: network.RoomPeerEvent
  ): void => {
    this.#syncPeer(event.clientId);
  };
  #onPeerLeft = (
    event: network.RoomPeerEvent
  ): void => {
    this.#removePeer(event.clientId);
  };
  #onPeerPresence = (
    event: network.RoomPeerPresenceEvent
  ): void => {
    this.#applyPresencePatch(event.clientId, event.patch);
  };
  #onLocalSelectionChange = (): void => {
    this.#reportLocal(this.#selection.selected);
  };

  constructor(
    options: PeerSelectionSyncOptions<ClientMessage, ServerMessage>
  ) {
    this.#room = options.room;
    this.#registry = options.registry;
    this.#selection = options.selection;
    this.#presenceKey = options.presenceKey ?? kDefaultPresenceKey;
    const resyncIntervalMs = options.resyncIntervalMs ?? kDefaultResyncIntervalMs;

    this.#room.on("sync", this.#onSync);
    this.#room.on("peer-joined", this.#onPeerJoined);
    this.#room.on("peer-left", this.#onPeerLeft);
    this.#room.on("peer-presence", this.#onPeerPresence);
    this.#selection.addEventListener("selectionChange", this.#onLocalSelectionChange);

    for (const clientId of this.#room.peers.keys()) {
      this.#syncPeer(clientId);
    }
    this.#reportLocal(this.#selection.selected);

    if (resyncIntervalMs > 0) {
      const timer = setInterval(
        () => this.#resyncAll(),
        resyncIntervalMs
      );
      timer.unref?.();
      this.#resyncTimer = timer;
    }
  }

  destroy(): void {
    this.#room.off("sync", this.#onSync);
    this.#room.off("peer-joined", this.#onPeerJoined);
    this.#room.off("peer-left", this.#onPeerLeft);
    this.#room.off("peer-presence", this.#onPeerPresence);
    this.#selection.removeEventListener("selectionChange", this.#onLocalSelectionChange);

    if (this.#resyncTimer !== null) {
      clearInterval(this.#resyncTimer);
      this.#resyncTimer = null;
    }

    for (const clientId of [...this.#knownPeers]) {
      this.#removePeer(clientId);
    }
  }

  #resyncAll(): void {
    for (const clientId of this.#room.peers.keys()) {
      this.#syncPeer(clientId);
    }
  }

  #reportLocal(
    objectId: string | null
  ): void {
    this.#room.updatePresence({
      [this.#presenceKey]: objectId
    });
  }

  #syncPeer(
    clientId: string
  ): void {
    const peer = this.#room.peers.get(clientId);
    if (!peer) {
      return;
    }

    this.#applyPeer(clientId, peer.presence);
  }

  #applyPresencePatch(
    clientId: string,
    patch: network.PeerMetadata
  ): void {
    if (!(this.#presenceKey in patch)) {
      return;
    }

    this.#applyPeer(clientId, patch);
  }

  #applyPeer(
    clientId: string,
    presence: network.PeerMetadata
  ): void {
    const objectId = decodePeerSelectionId(presence[this.#presenceKey]);
    if (objectId === undefined) {
      return;
    }

    this.#knownPeers.add(clientId);
    this.#registry.select(clientId, objectId);
  }

  #removePeer(
    clientId: string
  ): void {
    if (!this.#knownPeers.has(clientId)) {
      return;
    }

    this.#knownPeers.delete(clientId);
    this.#registry.removePeer(clientId);
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
