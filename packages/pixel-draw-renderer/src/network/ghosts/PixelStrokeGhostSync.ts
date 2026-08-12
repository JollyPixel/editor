// Import Internal Dependencies
import { isVec2 } from "../../utils/math.ts";
import {
  PeerPresenceGhostSync,
  type PeerPresenceGhostSyncOptions
} from "./PeerPresenceGhostSync.ts";
import type {
  PixelArtCanvas
} from "../../PixelArtCanvas.ts";
import type {
  PeerStrokePixel
} from "../../types.ts";
import type {
  PixelNetworkCommand
} from "../types.ts";

export type PixelStrokeGhostSyncOptions = PeerPresenceGhostSyncOptions;

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
export class PixelStrokeGhostSync extends PeerPresenceGhostSync<PeerStrokePixel[]> {
  protected readonly presenceKey = "strokeGhost";

  #previousHandler: ((pixels: PeerStrokePixel[]) => void) | undefined;

  #handleStrokeProgress = (
    pixels: PeerStrokePixel[]
  ): void => {
    this.#previousHandler?.(pixels);
    this.reportLocal(pixels);
  };

  protected isEmptyPayload(
    pixels: PeerStrokePixel[]
  ): boolean {
    return pixels.length === 0;
  }

  protected subscribeLocal(
    canvas: PixelArtCanvas
  ): void {
    this.#previousHandler = canvas.onStrokeProgress;
    canvas.onStrokeProgress = this.#handleStrokeProgress;
  }

  protected unsubscribeLocal(
    canvas: PixelArtCanvas
  ): void {
    canvas.onStrokeProgress = this.#previousHandler;
    this.#previousHandler = undefined;
  }

  protected decodePayload(
    value: unknown
  ): PeerStrokePixel[] | undefined {
    return isPeerStrokePixels(value) ? value : undefined;
  }

  protected applyGhost(
    clientId: string,
    pixels: PeerStrokePixel[],
    canvas: PixelArtCanvas
  ): void {
    canvas.peerPresence.strokes.set(clientId, pixels);
  }

  protected clearGhost(
    clientId: string
  ): void {
    this.canvas?.peerPresence.strokes.remove(clientId);
  }

  protected clearAllGhosts(): void {
    this.canvas?.peerPresence.strokes.clearAll();
  }

  protected reconcileCommand(
    command: PixelNetworkCommand
  ): void {
    if (!this.canvas) {
      return;
    }

    switch (command.action) {
      case "stroke":
        this.canvas.peerPresence.strokes.removeOverlapping(
          command.metadata.positions
        );
        break;
      case "global-fill":
      case "resized":
      case "texture-replaced":
        // Whole-canvas ops have no positions; clear all ghosts.
        this.clearLeases();
        this.clearAllGhosts();
        break;
      default:
        break;
    }
  }
}
