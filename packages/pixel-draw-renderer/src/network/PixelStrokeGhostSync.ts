// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { isVec2 } from "../utils/math.ts";
import { PeerGhostLeaser } from "./PeerGhostLeaser.ts";
import type {
  PixelArtCanvas
} from "../PixelArtCanvas.ts";
import type {
  PeerStrokePixel
} from "../types.ts";
import type {
  PixelNetworkCommand,
  PixelServerMessage
} from "./types.ts";

// CONSTANTS
const kPresenceStrokeKey = "strokeGhost";

export interface PixelStrokeGhostSyncOptions {
  room: network.Room<PixelNetworkCommand, PixelServerMessage>;
  /**
   * Stream in-progress peer pixels; disable to reduce presence traffic.
   * @default true
   */
  enableGhostPreview?: boolean;
}

function isPeerStrokePixel(
  value: unknown
): value is PeerStrokePixel {
  return isVec2(value) && "color" in value;
}

function isPeerStrokePixels(
  value: unknown
): value is PeerStrokePixel[] {
  return Array.isArray(value) && value.every(isPeerStrokePixel);
}

/**
 * Streams non-authoritative stroke ghosts through presence only.
 */
export class PixelStrokeGhostSync {
  #room: network.Room<PixelNetworkCommand, PixelServerMessage>;
  #enableGhostPreview: boolean;
  #canvas: PixelArtCanvas | undefined;
  #previousHandler: ((pixels: PeerStrokePixel[]) => void) | undefined;
  #pendingPixels: PeerStrokePixel[] | undefined;
  #rafHandle: number | undefined;
  #ghostLeaser: PeerGhostLeaser;

  #handleStrokeProgress = (
    pixels: PeerStrokePixel[]
  ): void => {
    this.#previousHandler?.(pixels);
    this.#reportLocal(pixels);
  };

  #onPeerLeft = (
    event: network.RoomPeerEvent
  ): void => {
    this.#ghostLeaser.cancel(event.clientId);
    this.#removePeerGhost(event.clientId);
  };

  #onPeerPresence = (
    event: network.RoomPeerPresenceEvent
  ): void => {
    this.#applyPresencePatch(
      event.clientId,
      event.patch
    );
  };

  #onMessage = (
    message: PixelServerMessage
  ): void => {
    if (message.type === "command") {
      this.#reconcileCommand(message.data);
    }
    else if (message.type === "snapshot") {
      this.#ghostLeaser.clear();
      this.#canvas?.peerPresence.strokes.clearAll();
    }
  };

  constructor(
    options: PixelStrokeGhostSyncOptions
  ) {
    this.#room = options.room;
    this.#enableGhostPreview = options.enableGhostPreview ?? true;
    this.#ghostLeaser = new PeerGhostLeaser({
      onExpire: (clientId) => this.#removePeerGhost(clientId)
    });

    if (this.#enableGhostPreview) {
      this.#room.on(
        "peer-left",
        this.#onPeerLeft
      );
      this.#room.on(
        "peer-presence",
        this.#onPeerPresence
      );
      this.#room.on(
        "message",
        this.#onMessage
      );
    }
  }

  attach(
    canvas: PixelArtCanvas
  ): void {
    if (this.#canvas) {
      throw new Error("A canvas is already attached to this session");
    }

    this.#canvas = canvas;
    if (this.#enableGhostPreview) {
      this.#previousHandler = canvas.onStrokeProgress;
      canvas.onStrokeProgress = this.#handleStrokeProgress;
      for (const [clientId, peer] of this.#room.peers) {
        this.#applyPresencePatch(clientId, peer.presence);
      }
    }
  }

  detach(): void {
    if (!this.#canvas) {
      return;
    }

    this.#cancelPending();
    if (this.#enableGhostPreview) {
      this.#ghostLeaser.clear();
      this.#canvas.peerPresence.strokes.clearAll();
      this.#canvas.onStrokeProgress = this.#previousHandler;
    }
    this.#canvas = undefined;
    this.#previousHandler = undefined;
  }

  destroy(): void {
    this.detach();
    this.#ghostLeaser.clear();
    this.#room.off(
      "peer-left",
      this.#onPeerLeft
    );
    this.#room.off(
      "peer-presence",
      this.#onPeerPresence
    );
    this.#room.off(
      "message",
      this.#onMessage
    );
  }

  #removePeerGhost(
    clientId: string
  ): void {
    this.#canvas?.peerPresence.strokes.remove(clientId);
  }

  #reportLocal(
    pixels: PeerStrokePixel[]
  ): void {
    // Drop queued ticks after commit so cleared ghosts cannot reappear.
    if (pixels.length === 0) {
      this.#cancelPending();

      return;
    }

    this.#pendingPixels = pixels;
    if (this.#rafHandle !== undefined) {
      return;
    }

    this.#rafHandle = requestAnimationFrame(() => {
      this.#rafHandle = undefined;
      if (this.#pendingPixels) {
        this.#room.updatePresence({
          [kPresenceStrokeKey]: this.#pendingPixels
        });
      }
    });
  }

  #cancelPending(): void {
    if (this.#rafHandle !== undefined) {
      cancelAnimationFrame(this.#rafHandle);
      this.#rafHandle = undefined;
    }
    this.#pendingPixels = undefined;
  }

  #reconcileCommand(
    command: PixelNetworkCommand
  ): void {
    if (!this.#canvas) {
      return;
    }

    switch (command.action) {
      case "stroke":
        this.#canvas.peerPresence.strokes.removeOverlapping(
          command.metadata.positions
        );
        break;
      case "global-fill":
      case "resized":
      case "texture-replaced":
        // Whole-canvas ops have no positions; clear all ghosts.
        this.#ghostLeaser.clear();
        this.#canvas.peerPresence.strokes.clearAll();
        break;
      default:
        break;
    }
  }

  #applyPresencePatch(
    clientId: string,
    patch: network.PeerMetadata
  ): void {
    if (!this.#canvas || !(kPresenceStrokeKey in patch)) {
      return;
    }

    const pixels = patch[kPresenceStrokeKey];
    if (isPeerStrokePixels(pixels)) {
      this.#canvas.peerPresence.strokes.set(
        clientId,
        pixels
      );
      this.#ghostLeaser.renew(clientId);
    }
  }
}
