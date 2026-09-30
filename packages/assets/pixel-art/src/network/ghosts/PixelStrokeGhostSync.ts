// Import Third-party Dependencies
import type {
  PeerStrokePixel,
  PixelArtCanvas
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { PeerGhostStream } from "./PeerGhostStream.ts";
import { StrokeGhostEncoder } from "./StrokeGhostEncoder.ts";
import { StrokeGhostLayer } from "./StrokeGhostLayer.ts";
import { isStrokeGhostFrame } from "./presenceGuards.ts";
import type {
  PixelArtRoom,
  PixelNetworkCommand,
  StrokeGhostFrame
} from "../types.ts";

export interface PixelStrokeGhostSyncOptions {
  room: PixelArtRoom;
  canvas: PixelArtCanvas;
}

function decodeStrokeGhost(
  value: unknown
): StrokeGhostFrame | undefined {
  return isStrokeGhostFrame(value) ? value : undefined;
}

export class PixelStrokeGhostSync {
  #canvas: PixelArtCanvas;
  #stream: PeerGhostStream<StrokeGhostFrame>;
  #encoder = new StrokeGhostEncoder();
  #previousHandler: ((pixels: PeerStrokePixel[]) => void) | undefined;

  #handleStrokeProgress = (
    pixels: PeerStrokePixel[]
  ): void => {
    this.#previousHandler?.(pixels);
    if (pixels.length === 0) {
      this.#encoder.reset();
      this.#stream.clearLocal();

      return;
    }

    const frame = this.#encoder.encode(pixels);
    if (frame !== null) {
      this.#stream.report(frame);
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
      layer: new StrokeGhostLayer(canvas.peerPresence.strokes),
      reconcile: (command) => this.#reconcile(command),
      merge: StrokeGhostEncoder.merge
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
