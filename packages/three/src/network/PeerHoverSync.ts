// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type { PeerHoverRegistry } from "../selection/peer/PeerHoverRegistry.ts";
import type { SelectionManager } from "../selection/SelectionManager.ts";

// CONSTANTS
const kDefaultPresenceKey = "hover";
const kDefaultThrottleMs = 80;
const kDefaultResyncIntervalMs = 1_000;

export type PeerHoverId = string | null;

export interface PeerHoverSyncOptions<
  ClientMessage = unknown,
  ServerMessage = unknown
> {
  room: network.Room<ClientMessage, ServerMessage>;
  registry: PeerHoverRegistry;
  selection: SelectionManager;
  /**
   * Presence field for hover ids.
   * @default "hover"
   */
  presenceKey?: string;
  /**
   * Minimum milliseconds between hover updates. The latest update is delayed,
   * not dropped.
   * @default 80
   */
  throttleMs?: number;
  /**
   * Milliseconds between reconciliations with `room.peers`. `0` disables them.
   * @default 1000
   */
  resyncIntervalMs?: number;
}

/**
 * Syncs local and remote hover ids through room presence.
 * Selection precedence is left to renderers.
 */
export class PeerHoverSync<
  ClientMessage = unknown,
  ServerMessage = unknown
> {
  #room: network.Room<ClientMessage, ServerMessage>;
  #registry: PeerHoverRegistry;
  #selection: SelectionManager;
  #presenceKey: string;
  #throttleMs: number;

  #hasSent = false;
  #lastSentAt = 0;
  #pendingObjectId: PeerHoverId = null;
  #flushTimer: ReturnType<typeof setTimeout> | null = null;
  #resyncTimer: ReturnType<typeof setInterval> | null = null;

  #knownPeers = new Set<string>();

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
  #onLocalHoverChange = (): void => {
    this.#reportLocal(this.#selection.hovered);
  };

  constructor(
    options: PeerHoverSyncOptions<ClientMessage, ServerMessage>
  ) {
    this.#room = options.room;
    this.#registry = options.registry;
    this.#selection = options.selection;
    this.#presenceKey = options.presenceKey ?? kDefaultPresenceKey;
    this.#throttleMs = options.throttleMs ?? kDefaultThrottleMs;
    const resyncIntervalMs = options.resyncIntervalMs ?? kDefaultResyncIntervalMs;

    this.#room.on("sync", this.#onSync);
    this.#room.on("peer-joined", this.#onPeerJoined);
    this.#room.on("peer-left", this.#onPeerLeft);
    this.#room.on("peer-presence", this.#onPeerPresence);
    this.#selection.addEventListener("hoverChange", this.#onLocalHoverChange);

    for (const clientId of this.#room.peers.keys()) {
      this.#syncPeer(clientId);
    }
    this.#reportLocal(this.#selection.hovered);

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
    this.#selection.removeEventListener("hoverChange", this.#onLocalHoverChange);

    if (this.#flushTimer !== null) {
      clearTimeout(this.#flushTimer);
      this.#flushTimer = null;
    }
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
    objectId: PeerHoverId
  ): void {
    if (this.#flushTimer !== null) {
      this.#pendingObjectId = objectId;

      return;
    }

    const elapsed = Date.now() - this.#lastSentAt;
    if (!this.#hasSent || elapsed >= this.#throttleMs) {
      this.#send(objectId);

      return;
    }

    this.#pendingObjectId = objectId;
    this.#flushTimer = setTimeout(() => {
      this.#flushTimer = null;
      this.#send(this.#pendingObjectId);
    }, this.#throttleMs - elapsed);
  }

  #send(
    objectId: PeerHoverId
  ): void {
    this.#hasSent = true;
    this.#lastSentAt = Date.now();
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
    const objectId = decodePeerHoverId(presence[this.#presenceKey]);
    if (objectId === undefined) {
      return;
    }

    this.#knownPeers.add(clientId);
    this.#registry.hover(clientId, objectId);
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

export function decodePeerHoverId(
  value: unknown
): PeerHoverId | undefined {
  if (value === null || typeof value === "string") {
    return value;
  }

  return undefined;
}
