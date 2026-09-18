// Import Third-party Dependencies
import {
  PresenceChannel,
  type PresenceChange,
  type Room
} from "@jolly-pixel/network/client";
import {
  isVec2,
  vec2Equal,
  type PixelArtCanvas,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  peerProfile,
  type PeerColor,
  type PeerLabel
} from "./peerAppearance.ts";
import type {
  PixelNetworkCommand,
  PixelServerMessage
} from "./types.ts";

export interface PixelCursorSyncOptions {
  room: Room<PixelNetworkCommand, PixelServerMessage>;
  canvas: PixelArtCanvas;
  label: PeerLabel;
  color: PeerColor;
}

function decodeCursor(
  value: unknown
): Vec2 | null | undefined {
  return value === null || isVec2(value) ? value : undefined;
}

export class PixelCursorSync {
  #room: Room<PixelNetworkCommand, PixelServerMessage>;
  #canvas: PixelArtCanvas;
  #channel: PresenceChannel<Vec2 | null>;
  #label: PeerLabel;
  #color: PeerColor;
  #previousHandler: ((pos: Vec2 | null) => void) | undefined;

  #handleCursorMove = (
    pos: Vec2 | null
  ): void => {
    this.#previousHandler?.(pos);
    this.#channel.publish(pos);
  };

  #onPeerChange = (
    change: PresenceChange<Vec2 | null>
  ): void => {
    if (change.value === undefined) {
      this.#canvas.peerPresence.cursors.remove(change.clientId);
    }
    else {
      this.#render(change.clientId, change.value);
    }
  };

  constructor(
    options: PixelCursorSyncOptions
  ) {
    this.#room = options.room;
    this.#canvas = options.canvas;
    this.#label = options.label;
    this.#color = options.color;
    this.#channel = new PresenceChannel(options.room, {
      key: "cursor",
      decode: decodeCursor,
      equals: vec2Equal
    });

    for (const [clientId, pos] of this.#channel.values) {
      this.#render(clientId, pos);
    }
    this.#channel.on("change", this.#onPeerChange);
    this.#previousHandler = this.#canvas.onCursorMove;
    this.#canvas.onCursorMove = this.#handleCursorMove;
  }

  destroy(): void {
    this.#canvas.onCursorMove = this.#previousHandler;
    this.#channel.destroy();
  }

  #render(
    clientId: string,
    pos: Vec2 | null
  ): void {
    const profile = peerProfile(this.#room, clientId);

    this.#canvas.peerPresence.cursors.set(clientId, {
      pos,
      color: this.#color(clientId, profile),
      label: this.#label(clientId, profile)
    });
  }
}
