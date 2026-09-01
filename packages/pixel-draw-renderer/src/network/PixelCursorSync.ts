// Import Third-party Dependencies
import { ColorPalette } from "@jolly-pixel/color";
import type * as network from "@jolly-pixel/network/client";

// Import Internal Dependencies
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
  label?: (identity: network.PeerMetadata) => string | undefined;
  /**
   * Chooses the color of a remote peer's cursor.
   *
   * @default a deterministic color from the built-in palette
   */
  color?: (
    clientId: string,
    identity: network.PeerMetadata
  ) => string;
}

function defaultLabel(
  identity: network.PeerMetadata
): string | undefined {
  return typeof identity.username === "string" ? identity.username : undefined;
}

/**
 * Mirrors local and remote cursor state through room presence.
 */
export class PixelCursorSync {
  #room: network.Room<PixelNetworkCommand, PixelServerMessage>;
  #label: (identity: network.PeerMetadata) => string | undefined;
  #color: (
    clientId: string,
    identity: network.PeerMetadata
  ) => string;
  #palette = new ColorPalette();
  #canvas: PixelArtCanvas | undefined;
  #previousHandler: ((pos: Vec2 | null) => void) | undefined;
  #lastSent: Vec2 | null | undefined;
  #renderedPeers = new Set<string>();

  #handleCursorMove = (
    pos: Vec2 | null
  ): void => {
    this.#previousHandler?.(pos);
    this.#reportLocal(pos);
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
    this.#applyPresencePatch(
      event.clientId,
      event.patch
    );
  };

  constructor(
    options: PixelCursorSyncOptions
  ) {
    this.#room = options.room;
    this.#label = options.label ?? defaultLabel;
    this.#color = options.color ?? (
      (clientId) => this.#palette.forKey(clientId)
    );

    this.#room.on(
      "peer-joined",
      this.#onPeerJoined
    );
    this.#room.on(
      "peer-left",
      this.#onPeerLeft
    );
    this.#room.on(
      "peer-presence",
      this.#onPeerPresence
    );
  }

  attach(
    canvas: PixelArtCanvas
  ): void {
    if (this.#canvas) {
      throw new Error("A canvas is already attached to this session");
    }

    this.#canvas = canvas;
    this.#previousHandler = canvas.onCursorMove;
    canvas.onCursorMove = this.#handleCursorMove;
    for (const clientId of this.#room.peers.keys()) {
      this.#syncPeer(clientId);
    }
  }

  detach(): void {
    if (!this.#canvas) {
      return;
    }

    this.#canvas.onCursorMove = this.#previousHandler;
    this.#clearPeers();
    this.#canvas = undefined;
    this.#previousHandler = undefined;
    this.#lastSent = undefined;
  }

  destroy(): void {
    this.detach();

    this.#room.off(
      "peer-joined",
      this.#onPeerJoined
    );
    this.#room.off(
      "peer-left",
      this.#onPeerLeft
    );
    this.#room.off(
      "peer-presence",
      this.#onPeerPresence
    );
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
    this.#canvas.peerPresence.cursors.set(clientId, {
      pos: isVec2(rawPos) ? rawPos : null,
      color: this.#color(clientId, identity),
      label: this.#label(identity)
    });
    this.#renderedPeers.add(clientId);
  }

  #removePeer(
    clientId: string
  ): void {
    this.#canvas?.peerPresence.cursors.remove(clientId);
    this.#renderedPeers.delete(clientId);
  }

  #clearPeers(): void {
    for (const clientId of this.#renderedPeers) {
      this.#canvas?.peerPresence.cursors.remove(clientId);
    }
    this.#renderedPeers.clear();
  }
}
