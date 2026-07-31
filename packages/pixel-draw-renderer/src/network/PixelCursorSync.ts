// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { ColorPalette } from "../utils/ColorPalette.ts";
import {
  isVec2,
  vec2Equal
} from "../utils/math.ts";
import type { PixelArtCanvas } from "../PixelArtCanvas.ts";
import type { Vec2 } from "../types.ts";
import type {
  PixelNetworkCommand,
  PixelServerMessage
} from "./types.ts";

// CONSTANTS
const kPresenceCursorKey = "cursor";

export interface PixelCursorSyncOptions {
  room: network.Room<PixelNetworkCommand, PixelServerMessage>;
  /**
   * Extracts a display label from a peer's identity.
   * @default reads `identity.username` when it's a string
   */
  getLabel?: (identity: network.PeerMetadata) => string | undefined;
}

function defaultGetLabel(
  identity: network.PeerMetadata
): string | undefined {
  return typeof identity.username === "string" ? identity.username : undefined;
}

/**
 * Broadcasts the local cursor position over a `network.Room`'s presence
 * channel and mirrors remote peers' cursors onto the attached canvas's
 * `peerCursors` overlay.
 */
export class PixelCursorSync {
  #room: network.Room<PixelNetworkCommand, PixelServerMessage>;
  #getLabel: (identity: network.PeerMetadata) => string | undefined;
  #palette = new ColorPalette();
  #canvas: PixelArtCanvas | undefined;
  #lastSent: Vec2 | null | undefined;

  #onPeerJoined = (
    event: network.RoomPeerEvent
  ): void => {
    this.#syncPeer(event.clientId);
  };
  #onPeerLeft = (
    event: network.RoomPeerEvent
  ): void => {
    this.#canvas?.peerCursors.remove(event.clientId);
  };
  #onPeerPresence = (
    event: network.RoomPeerPresenceEvent
  ): void => {
    this.#applyPresencePatch(event.clientId, event.patch);
  };

  constructor(
    options: PixelCursorSyncOptions
  ) {
    this.#room = options.room;
    this.#getLabel = options.getLabel ?? defaultGetLabel;

    this.#room.on("peer-joined", this.#onPeerJoined);
    this.#room.on("peer-left", this.#onPeerLeft);
    this.#room.on("peer-presence", this.#onPeerPresence);
  }

  attach(
    canvas: PixelArtCanvas
  ): void {
    if (this.#canvas) {
      throw new Error("A canvas is already attached to this session");
    }

    this.#canvas = canvas;
    canvas.onCursorMove = (pos) => this.#reportLocal(pos);
    for (const clientId of this.#room.peers.keys()) {
      this.#syncPeer(clientId);
    }
  }

  detach(): void {
    if (!this.#canvas) {
      return;
    }

    this.#canvas.onCursorMove = undefined;
    this.#canvas = undefined;
    this.#lastSent = undefined;
  }

  destroy(): void {
    this.detach();
    this.#room.off("peer-joined", this.#onPeerJoined);
    this.#room.off("peer-left", this.#onPeerLeft);
    this.#room.off("peer-presence", this.#onPeerPresence);
  }

  #reportLocal(
    pos: Vec2 | null
  ): void {
    if (
      this.#lastSent !== undefined &&
      vec2Equal(pos, this.#lastSent)
    ) {
      return;
    }

    this.#lastSent = pos;
    this.#room.updatePresence({
      [kPresenceCursorKey]: pos
    });
  }

  #syncPeer(
    clientId: string
  ): void {
    const peer = this.#room.peers.get(clientId);
    if (!peer) {
      return;
    }

    this.#applyPeer(
      clientId,
      peer.identity,
      peer.presence
    );
  }

  #applyPresencePatch(
    clientId: string,
    patch: network.PeerMetadata
  ): void {
    if (!(kPresenceCursorKey in patch)) {
      return;
    }

    const identity = this.#room.peers.get(clientId)?.identity ?? {};
    this.#applyPeer(
      clientId,
      identity,
      patch
    );
  }

  #applyPeer(
    clientId: string,
    identity: network.PeerMetadata,
    presence: network.PeerMetadata
  ): void {
    if (!this.#canvas) {
      return;
    }

    const rawPos = presence[kPresenceCursorKey];
    this.#canvas.peerCursors.set(clientId, {
      pos: isVec2(rawPos) ? rawPos : null,
      color: this.#palette.forKey(clientId),
      label: this.#getLabel(identity)
    });
  }
}
