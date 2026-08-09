// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { isVec2 } from "../utils/math.ts";
import type { PixelArtCanvas } from "../PixelArtCanvas.ts";
import type { PeerStrokePixel } from "../types.ts";
import type {
  PixelNetworkCommand,
  PixelServerMessage
} from "./types.ts";

// CONSTANTS
const kPresenceStrokeKey = "strokeGhost";

export interface PixelStrokeGhostSyncOptions {
  room: network.Room<PixelNetworkCommand, PixelServerMessage>;
  /**
   * Streams a peer's in-progress pixels as they draw. Costs extra
   * presence traffic and render work; disable for bandwidth-constrained
   * sessions.
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
 * Broadcasts the local in-progress stroke/drag pixels over a `network.Room`'s
 * presence channel and mirrors remote peers' ghosts onto the attached
 * canvas's `peerStrokeGhosts` overlay. Purely ephemeral — never touches
 * history or the authoritative buffer; a peer's ghost is cleared the moment
 * any authoritative command from them arrives, or after a period of
 * inactivity.
 */
export class PixelStrokeGhostSync {
  #room: network.Room<PixelNetworkCommand, PixelServerMessage>;
  #enableGhostPreview: boolean;
  #canvas: PixelArtCanvas | undefined;
  #pendingPixels: PeerStrokePixel[] | undefined;
  #rafHandle: number | undefined;

  #onPeerLeft = (
    event: network.RoomPeerEvent
  ): void => {
    this.#canvas?.peerStrokeGhosts.remove(event.clientId);
  };
  #onPeerPresence = (
    event: network.RoomPeerPresenceEvent
  ): void => {
    this.#applyPresencePatch(event.clientId, event.patch);
  };
  #onMessage = (
    message: PixelServerMessage
  ): void => {
    if (message.type === "command") {
      this.#reconcileCommand(message.data);
    }
    else if (message.type === "snapshot") {
      this.#canvas?.peerStrokeGhosts.clearAll();
    }
  };

  constructor(
    options: PixelStrokeGhostSyncOptions
  ) {
    this.#room = options.room;
    this.#enableGhostPreview = options.enableGhostPreview ?? true;

    if (this.#enableGhostPreview) {
      this.#room.on("peer-left", this.#onPeerLeft);
      this.#room.on("peer-presence", this.#onPeerPresence);
      this.#room.on("message", this.#onMessage);
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
      canvas.onStrokeProgress = (pixels) => this.#reportLocal(pixels);
    }
  }

  detach(): void {
    if (!this.#canvas) {
      return;
    }

    this.#cancelPending();
    this.#canvas.onStrokeProgress = undefined;
    this.#canvas = undefined;
  }

  destroy(): void {
    this.detach();
    this.#room.off("peer-left", this.#onPeerLeft);
    this.#room.off("peer-presence", this.#onPeerPresence);
    this.#room.off("message", this.#onMessage);
  }

  #reportLocal(
    pixels: PeerStrokePixel[]
  ): void {
    // An empty array is the "gesture just committed" signal (see
    // BrushController/LineController/SelectController): the authoritative
    // command is already on its way to peers, synchronously, ahead of any
    // rAF-queued pre-commit tick below — drop it instead of letting it
    // resurrect the ghost peers just saw cleared.
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

  /**
   * Clears a ghost by matching the pixels the command affects, not the
   * command's `clientId` — the server's connection-tracked peer id (what
   * presence updates are keyed by) and a command's embedded `clientId`
   * (self-asserted by the sending client) are not the same value, so
   * matching by clientId here would silently never clear anything.
   */
  #reconcileCommand(
    cmd: PixelNetworkCommand
  ): void {
    if (!this.#canvas) {
      return;
    }

    switch (cmd.action) {
      case "stroke":
        this.#canvas.peerStrokeGhosts.removeOverlapping(cmd.metadata.positions);
        break;
      case "select-edit":
        this.#canvas.peerStrokeGhosts.removeOverlapping(cmd.metadata.positions);
        break;
      case "global-fill":
      case "resized":
      case "texture-replaced":
        // Whole-canvas operations: no itemized positions, so any active
        // ghost is stale.
        this.#canvas.peerStrokeGhosts.clearAll();
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
      this.#canvas.peerStrokeGhosts.set(clientId, pixels);
    }
  }
}
