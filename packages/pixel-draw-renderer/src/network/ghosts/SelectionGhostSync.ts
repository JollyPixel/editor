// Import Third-party Dependencies
import { ColorPalette } from "@jolly-pixel/color";

// Import Internal Dependencies
import {
  PeerPresenceGhostSync,
  type PeerPresenceGhostSyncOptions
} from "./PeerPresenceGhostSync.ts";
import type {
  PixelArtCanvas
} from "../../PixelArtCanvas.ts";
import type {
  SelectionProgressEvent
} from "../../tools/SelectEngine.events.ts";
import type {
  PixelNetworkCommand,
  SelectionGhostPayload
} from "../types.ts";

export type SelectionGhostSyncOptions = PeerPresenceGhostSyncOptions;

function isSelectionGhostPayload(
  value: unknown
): value is SelectionGhostPayload {
  if (typeof value !== "object" || value === null || !("phase" in value)) {
    return false;
  }

  if (value.phase === "creating") {
    return "rect" in value && typeof value.rect === "object" && value.rect !== null;
  }

  if (value.phase === "moving") {
    return "sourceRect" in value &&
      "liveRect" in value &&
      "mask" in value &&
      Array.isArray(value.mask) &&
      "blankSource" in value;
  }

  return false;
}

/**
 * Streams non-authoritative selection ghosts through presence only.
 */
export class SelectionGhostSync extends PeerPresenceGhostSync<SelectionGhostPayload> {
  protected readonly presenceKey = "selectionGhost";

  #palette = new ColorPalette();

  #onSelectionProgress = (
    event: SelectionProgressEvent
  ): void => {
    this.reportLocal(event);
  };

  #onSelectionCommitted = (): void => {
    // Drop queued ticks after commit so cleared ghosts cannot reappear.
    this.cancelPending();
  };

  #onSelectionIdle = (): void => {
    // No command follows, so clear presence without waiting for timeout.
    this.cancelPending();
    this.clearPresence();
  };

  protected isExplicitClear(
    value: unknown
  ): boolean {
    return value === null;
  }

  protected subscribeLocal(
    canvas: PixelArtCanvas
  ): void {
    canvas.selectionEvents.on(
      "selection-progress",
      this.#onSelectionProgress
    );
    canvas.selectionEvents.on(
      "selection-committed",
      this.#onSelectionCommitted
    );
    canvas.selectionEvents.on(
      "selection-idle",
      this.#onSelectionIdle
    );
  }

  protected unsubscribeLocal(
    canvas: PixelArtCanvas
  ): void {
    canvas.selectionEvents.off(
      "selection-progress",
      this.#onSelectionProgress
    );
    canvas.selectionEvents.off(
      "selection-committed",
      this.#onSelectionCommitted
    );
    canvas.selectionEvents.off(
      "selection-idle",
      this.#onSelectionIdle
    );
  }

  protected decodePayload(
    value: unknown
  ): SelectionGhostPayload | undefined {
    return isSelectionGhostPayload(value) ? value : undefined;
  }

  protected applyGhost(
    clientId: string,
    payload: SelectionGhostPayload,
    canvas: PixelArtCanvas
  ): void {
    const color = this.#palette.forKey(clientId);

    if (payload.phase === "creating") {
      canvas.peerPresence.selectionOutlines.set(clientId, {
        rect: payload.rect,
        mask: null,
        color
      });
      // A new marquee has no source footprint to blank.
      canvas.peerPresence.floatingSelections.remove(clientId);

      return;
    }

    canvas.peerPresence.selectionOutlines.set(clientId, {
      rect: payload.liveRect,
      mask: payload.mask,
      color
    });
    canvas.peerPresence.floatingSelections.set(clientId, {
      sourceRect: payload.sourceRect,
      liveRect: payload.liveRect,
      mask: payload.mask,
      blankSource: payload.blankSource
    });
  }

  protected clearGhost(
    clientId: string
  ): void {
    this.canvas?.peerPresence.selectionOutlines.remove(clientId);
    this.canvas?.peerPresence.floatingSelections.remove(clientId);
  }

  protected clearAllGhosts(): void {
    this.canvas?.peerPresence.selectionOutlines.clearAll();
    this.canvas?.peerPresence.floatingSelections.clearAll();
  }

  protected reconcileCommand(
    command: PixelNetworkCommand
  ): void {
    if (!this.canvas) {
      return;
    }

    switch (command.action) {
      case "select-edit":
        this.canvas.peerPresence.selectionOutlines.removeOverlapping(
          command.metadata.positions
        );
        this.canvas.peerPresence.floatingSelections.removeOverlapping(
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
