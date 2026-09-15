// Import Third-party Dependencies
import type { Room } from "@jolly-pixel/network/client";
import {
  isVec2,
  type PeerStrokePixel,
  type PixelArtCanvas
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { PeerGhostStream } from "./PeerGhostStream.ts";
import type {
  PixelNetworkCommand,
  PixelServerMessage
} from "../types.ts";

export interface PixelStrokeGhostSyncOptions {
  room: Room<PixelNetworkCommand, PixelServerMessage>;
  canvas: PixelArtCanvas;
}

function isPeerStrokePixel(
  value: unknown
): value is PeerStrokePixel {
  return isVec2(value) && "color" in value;
}

function decodeStrokeGhost(
  value: unknown
): PeerStrokePixel[] | undefined {
  return Array.isArray(value) && value.every(isPeerStrokePixel) ?
    value :
    undefined;
}

export class PixelStrokeGhostSync {
  #canvas: PixelArtCanvas;
  #stream: PeerGhostStream<PeerStrokePixel[]>;
  #previousHandler: ((pixels: PeerStrokePixel[]) => void) | undefined;

  #handleStrokeProgress = (
    pixels: PeerStrokePixel[]
  ): void => {
    this.#previousHandler?.(pixels);
    if (pixels.length === 0) {
      this.#stream.cancelPending();
    }
    else {
      this.#stream.report(pixels);
    }
  };

  constructor(
    options: PixelStrokeGhostSyncOptions
  ) {
    const { canvas } = options;

    this.#canvas = canvas;
    this.#stream = new PeerGhostStream({
      room: options.room,
      key: "strokeGhost",
      decode: decodeStrokeGhost,
      layer: canvas.peerPresence.strokes,
      reconcile: (command) => this.#reconcile(command)
    });
    this.#previousHandler = canvas.onStrokeProgress;
    canvas.onStrokeProgress = this.#handleStrokeProgress;
  }

  destroy(): void {
    this.#canvas.onStrokeProgress = this.#previousHandler;
    this.#stream.destroy();
  }

  #reconcile(
    command: PixelNetworkCommand
  ): void {
    switch (command.action) {
      case "stroke":
        this.#canvas.peerPresence.strokes.removeOverlapping(
          command.metadata.positions
        );
        break;
      case "global-fill":
      case "resized":
      case "texture-replaced":
        this.#stream.clearRemote();
        break;
      default:
        break;
    }
  }
}
