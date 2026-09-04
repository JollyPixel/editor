// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type { PeerSelectionRegistry } from "../selection/peer/PeerSelectionRegistry.ts";
import type { SelectionManager } from "../selection/SelectionManager.ts";
import { decodePeerSelectionId } from "./PeerSelectionId.ts";

// CONSTANTS
const kDefaultPresenceKey = "selection";
const kDefaultResyncIntervalMs = 5_000;

export interface PeerSelectionSyncOptions<
  ClientMessage = unknown,
  ServerMessage = unknown
> {
  room: network.Room<ClientMessage, ServerMessage>;
  /**
   * Remote peer selections read from the room are applied here.
   */
  registry: PeerSelectionRegistry;
  /**
   * Local selection state published to the room.
   */
  selection: SelectionManager;
  /**
   * Presence field selections are published under. Change it when a room
   * carries more than one selection stream.
   * @default "selection"
   */
  presenceKey?: string;
  /**
   * How often, in milliseconds, every currently connected peer's presence is
   * re-applied to `registry` from `room.peers` - a safety net against a
   * single dropped/out-of-order `peer-presence` message leaving `registry`
   * permanently stuck on stale state (the transport gives no ack/retry per
   * message, and this class is otherwise purely event-driven - nothing else
   * would ever correct a miss). Cheap: `PeerSelectionRegistry.select` itself
   * no-ops without dispatching when the id is already current, so a tick
   * that finds nothing stale costs one map lookup per connected peer and
   * emits nothing. Set to `0` to disable.
   * @default 5000
   */
  resyncIntervalMs?: number;
}

/**
 * Publishes the local `SelectionManager`'s selected id to a
 * `@jolly-pixel/network` room's presence, and applies every remote peer's
 * published id into a `PeerSelectionRegistry` - the network glue between the
 * two, the same role `PeerFrustumSync` plays for camera pose. Everything
 * downstream of `registry` (`PeerSelectionOverlays`, `PeerHighlightPass`,
 * `PeerSelectionChips`, `PeerSelectionVisibility`) is already
 * transport-agnostic and needs no changes to work against real peers.
 *
 * Unlike `PeerFrustumSync`, there is no `attach()`/`update()` split and no
 * per-frame polling: a `SelectionManager`'s `selectionChange` event already
 * fires exactly when the local selection changes, so publishing from that
 * listener is both necessary and sufficient - nothing here needs continuous
 * sampling the way camera motion does.
 *
 * Also unlike `PeerFrustumSync`, no local-identity stamping is needed to
 * agree on a peer's own color: `PeerSelectionRegistry.colorOf` is a pure,
 * peer-only function of the id `select()` is called with, and the local
 * user's own selection is never entered into `registry` at all (it stays in
 * `selection.color`/`selection.hoverColor`, rendered separately) - so simply
 * using the room's own server-assigned `clientId` as the registry's peer id
 * is sufficient for every peer to agree.
 */
export class PeerSelectionSync<
  ClientMessage = unknown,
  ServerMessage = unknown
> {
  #room: network.Room<ClientMessage, ServerMessage>;
  #registry: PeerSelectionRegistry;
  #selection: SelectionManager;
  #presenceKey: string;
  /**
   * Peers this instance has ever applied to `registry` - tracked so
   * `destroy()` only removes peers it actually added, not every peer the
   * registry might otherwise hold (e.g. one added directly by a caller).
   */
  #knownPeers = new Set<string>();
  /** `null` when `resyncIntervalMs` is `0` - see that option's own doc comment. */
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
      const timer = setInterval(() => this.#resyncAll(), resyncIntervalMs);
      // Node-only (absent in a browser's plain `number` handle) - lets an
      // instance a caller forgot to `destroy()` (e.g. a test harness) not
      // hold the process open on its own; a browser tab has no such concept,
      // so this is a no-op there.
      (timer as unknown as { unref?: () => void; }).unref?.();
      this.#resyncTimer = timer;
    }
  }

  /**
   * Unsubscribes from `room`/`selection`, stops the periodic resync (see
   * `resyncIntervalMs`'s own doc comment), and removes every peer this
   * instance applied to `registry` - mirrors `PeerFrustumSync.destroy()`'s
   * own peer cleanup, so tearing this down does not leave a stale peer
   * selection behind in a `registry` that outlives it.
   */
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

  /**
   * Re-applies every currently connected peer's presence from `room.peers`
   * into `registry` - the periodic safety net `resyncIntervalMs` schedules.
   * A peer whose registry state already matches costs `PeerSelectionRegistry.select`
   * one no-op comparison, nothing more (see that option's own doc comment).
   */
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
