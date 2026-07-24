// Import Internal Dependencies
import { ColorPalette } from "../utils/ColorPalette.ts";
import {
  isVec2,
  vec2Equal
} from "../utils/math.ts";
import type { PixelArtCanvas } from "../PixelArtCanvas.ts";
import type { Vec2 } from "../types.ts";
import type {
  PixelPeerIdentity,
  PixelPeerPresence,
  PixelPresenceChannel
} from "./types.ts";

// CONSTANTS
const kPresenceCursorKey = "cursor";

export interface PixelCursorSessionOptions {
  channel: PixelPresenceChannel;
  /**
   * Extracts a display label from a peer's identity.
   * @default reads `identity.username` when it's a string
   */
  getLabel?: (identity: PixelPeerIdentity) => string | undefined;
}

function defaultGetLabel(
  identity: PixelPeerIdentity
): string | undefined {
  return typeof identity.username === "string" ? identity.username : undefined;
}

/**
 * Broadcasts the local cursor position over a presence channel and mirrors
 * remote peers' cursors onto the attached canvas's `peerCursors` overlay.
 */
export class PixelCursorSession {
  #channel: PixelPresenceChannel;
  #getLabel: (identity: PixelPeerIdentity) => string | undefined;
  #palette = new ColorPalette();
  #canvas: PixelArtCanvas | undefined;
  #lastSent: Vec2 | null | undefined;

  #previousOnPeerJoined: ((clientId: string) => void) | null;
  #previousOnPeerLeft: ((clientId: string) => void) | null;
  #previousOnPeerPresence: ((clientId: string, patch: PixelPeerPresence) => void) | null;

  constructor(
    options: PixelCursorSessionOptions
  ) {
    this.#channel = options.channel;
    this.#getLabel = options.getLabel ?? defaultGetLabel;

    this.#previousOnPeerJoined = this.#channel.onPeerJoined;
    this.#previousOnPeerLeft = this.#channel.onPeerLeft;
    this.#previousOnPeerPresence = this.#channel.onPeerPresence;

    this.#channel.onPeerJoined = (clientId) => {
      this.#previousOnPeerJoined?.(clientId);
      this.#syncPeer(clientId);
    };
    this.#channel.onPeerLeft = (clientId) => {
      this.#previousOnPeerLeft?.(clientId);
      this.#canvas?.peerCursors.remove(clientId);
    };
    this.#channel.onPeerPresence = (clientId, patch) => {
      this.#previousOnPeerPresence?.(clientId, patch);
      this.#applyPresencePatch(clientId, patch);
    };
  }

  attach(
    canvas: PixelArtCanvas
  ): void {
    if (this.#canvas) {
      throw new Error("A canvas is already attached to this session");
    }

    this.#canvas = canvas;
    canvas.onCursorMove = (pos) => this.#reportLocal(pos);
    for (const clientId of this.#channel.peers.keys()) {
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
    this.#channel.onPeerJoined = this.#previousOnPeerJoined;
    this.#channel.onPeerLeft = this.#previousOnPeerLeft;
    this.#channel.onPeerPresence = this.#previousOnPeerPresence;
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
    this.#channel.updatePresence({
      [kPresenceCursorKey]: pos
    });
  }

  #syncPeer(
    clientId: string
  ): void {
    const peer = this.#channel.peers.get(clientId);
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
    patch: PixelPeerPresence
  ): void {
    if (!(kPresenceCursorKey in patch)) {
      return;
    }

    const identity = this.#channel.peers.get(clientId)?.identity ?? {};
    this.#applyPeer(
      clientId,
      identity,
      patch
    );
  }

  #applyPeer(
    clientId: string,
    identity: PixelPeerIdentity,
    presence: PixelPeerPresence
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
