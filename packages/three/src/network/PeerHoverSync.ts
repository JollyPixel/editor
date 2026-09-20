// Import Third-party Dependencies
import {
  PresenceChannel,
  type PresenceChange,
  type Room
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type { PeerHoverRegistry } from "../mesh-highlight/peer/PeerHoverRegistry.ts";
import type { MeshHighlightState } from "../mesh-highlight/MeshHighlightState.ts";

// CONSTANTS
const kDefaultPresenceKey = "hover";
const kDefaultThrottleMs = 80;

export type PeerHoverId = string | null;

export interface PeerHoverSyncOptions {
  room: Room;
  registry: PeerHoverRegistry;
  selection: MeshHighlightState;
  presenceKey?: string;
  throttleMs?: number;
}

export class PeerHoverSync {
  #channel: PresenceChannel<PeerHoverId>;
  #registry: PeerHoverRegistry;
  #selection: MeshHighlightState;
  #throttleMs: number;

  #hasSent = false;
  #lastSentAt = 0;
  #pendingObjectId: PeerHoverId = null;
  #flushTimer: ReturnType<typeof setTimeout> | null = null;

  #onPeerChange = (
    change: PresenceChange<PeerHoverId>
  ): void => {
    if (change.value === undefined) {
      this.#registry.removePeer(change.clientId);
    }
    else {
      this.#registry.hover(change.clientId, change.value);
    }
  };

  #onLocalHoverChange = (): void => {
    this.#reportLocal(this.#selection.hovered);
  };

  constructor(
    options: PeerHoverSyncOptions
  ) {
    this.#registry = options.registry;
    this.#selection = options.selection;
    this.#throttleMs = options.throttleMs ?? kDefaultThrottleMs;
    this.#channel = new PresenceChannel(options.room, {
      key: options.presenceKey ?? kDefaultPresenceKey,
      decode: decodePeerHoverId
    });

    for (const [clientId, objectId] of this.#channel.values) {
      this.#registry.hover(clientId, objectId);
    }
    this.#channel.on("change", this.#onPeerChange);
    this.#selection.addEventListener("hoverChange", this.#onLocalHoverChange);
    this.#reportLocal(this.#selection.hovered);
  }

  destroy(): void {
    this.#selection.removeEventListener("hoverChange", this.#onLocalHoverChange);
    if (this.#flushTimer !== null) {
      clearTimeout(this.#flushTimer);
      this.#flushTimer = null;
    }
    this.#channel.destroy();
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
    this.#channel.publish(objectId);
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
