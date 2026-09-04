// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type { PeerHoverRegistry } from "../selection/peer/PeerHoverRegistry.ts";
import type { SelectionManager } from "../selection/SelectionManager.ts";
import { decodePeerHoverId, type PeerHoverId } from "./PeerHoverId.ts";

// CONSTANTS
const kDefaultPresenceKey = "hover";
const kDefaultThrottleMs = 80;
// Shorter than `PeerSelectionSync`'s own default - hover is a transient,
// fast-moving, high-frequency stream (throttled at `kDefaultThrottleMs`,
// still one report per enter/exit) unlike a selection, which stays put until
// someone deliberately changes it. A drop is both more likely here (more
// messages sent) and less useful to fix on a multi-second delay - by the
// time a 5s-late correction landed, the cursor has usually moved on to
// something else entirely. Reconciling against `room.peers` is cheap
// regardless of cadence (a no-op per already-correct peer), so there's no
// real cost tradeoff to running this more often for hover specifically.
const kDefaultResyncIntervalMs = 1_000;

export interface PeerHoverSyncOptions<
  ClientMessage = unknown,
  ServerMessage = unknown
> {
  room: network.Room<ClientMessage, ServerMessage>;
  /**
   * Remote peer hovers read from the room are applied here.
   */
  registry: PeerHoverRegistry;
  /**
   * Local hover state published to the room.
   */
  selection: SelectionManager;
  /**
   * Presence field hovers are published under. Change it when a room
   * carries more than one hover stream.
   * @default "hover"
   */
  presenceKey?: string;
  /**
   * Minimum delay between two presence updates, in milliseconds. Unlike
   * `PeerFrustumSync`'s own `throttleMs` (which relies on `update()` being
   * polled every frame to retry a report the throttle dropped), this class
   * is event-driven - `SelectionManager`'s `hoverChange` fires once per
   * enter/exit, not continuously - so a report suppressed by the window is
   * scheduled to flush at the window's end instead of being dropped,
   * guaranteeing the latest hover state is always eventually published even
   * if no further hover change happens to arrive.
   * @default 80
   */
  throttleMs?: number;
  /**
   * How often, in milliseconds, every currently connected peer's presence is
   * re-applied to `registry` from `room.peers` - same safety net as
   * `PeerSelectionSync`'s own `resyncIntervalMs`, for the same reason (no
   * ack/retry on the transport, and this class is otherwise purely
   * event-driven), but a shorter default - see `kDefaultResyncIntervalMs`'s
   * own comment for why hover specifically wants a tighter window. Set to
   * `0` to disable.
   * @default 1000
   */
  resyncIntervalMs?: number;
}

/**
 * Publishes the local `SelectionManager`'s hovered id to a
 * `@jolly-pixel/network` room's presence, and applies every remote peer's
 * published id into a `PeerHoverRegistry` - the hover counterpart to
 * `PeerSelectionSync`, which this class otherwise mirrors closely (room
 * event wiring, peer lifecycle cleanup, no local-identity stamping needed
 * for peer color).
 *
 * Publishes `selection.hovered` verbatim, even when it equals
 * `selection.selected` or when some other object is already selected by a
 * peer - suppressing a hover indicator when a selection is present is a
 * rendering concern (see `PeerHoverOverlays`/`PeerHighlightPass`), not
 * something this transport-only class reconciles. Same non-goal
 * `PeerSelectionSync`'s own doc comment states for itself: this class only
 * ever carries the id string across the network.
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
  /** `null` when `resyncIntervalMs` is `0` - see that option's own doc comment. */
  #resyncTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Peers this instance has ever applied to `registry` - tracked so
   * `destroy()` only removes peers it actually added, same convention
   * `PeerSelectionSync` already uses.
   */
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
      const timer = setInterval(() => this.#resyncAll(), resyncIntervalMs);
      // Node-only (absent in a browser's plain `number` handle) - see
      // `PeerSelectionSync`'s own matching comment.
      (timer as unknown as { unref?: () => void; }).unref?.();
      this.#resyncTimer = timer;
    }
  }

  /**
   * Unsubscribes from `room`/`selection`, drops any pending trailing flush,
   * stops the periodic resync (see `resyncIntervalMs`'s own doc comment),
   * and removes every peer this instance applied to `registry` - mirrors
   * `PeerSelectionSync.destroy()`.
   */
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

  /**
   * Re-applies every currently connected peer's presence from `room.peers`
   * into `registry` - the periodic safety net `resyncIntervalMs` schedules,
   * same reasoning as `PeerSelectionSync#resyncAll`'s own doc comment.
   */
  #resyncAll(): void {
    for (const clientId of this.#room.peers.keys()) {
      this.#syncPeer(clientId);
    }
  }

  #reportLocal(
    objectId: PeerHoverId
  ): void {
    if (this.#flushTimer !== null) {
      // A trailing flush is already scheduled - just replace the value it
      // will send, no need for a second timer.
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
