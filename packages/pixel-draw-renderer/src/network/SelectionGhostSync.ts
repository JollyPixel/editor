// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network/client";

// Import Internal Dependencies
import {
  ColorPalette
} from "../utils/ColorPalette.ts";
import { PeerGhostLeaser } from "./PeerGhostLeaser.ts";
import type {
  PixelArtCanvas
} from "../PixelArtCanvas.ts";
import type {
  SelectionProgressEvent
} from "../tools/SelectController.events.ts";
import type {
  PixelNetworkCommand,
  PixelServerMessage,
  SelectionGhostPayload
} from "./types.ts";

// CONSTANTS
const kPresenceSelectionKey = "selectionGhost";

export interface SelectionGhostSyncOptions {
  room: network.Room<PixelNetworkCommand, PixelServerMessage>;
  /**
   * Stream in-progress selection geometry; disable to reduce presence traffic.
   * @default true
   */
  enableGhostPreview?: boolean;
}

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
export class SelectionGhostSync {
  #room: network.Room<PixelNetworkCommand, PixelServerMessage>;
  #enableGhostPreview: boolean;
  #palette = new ColorPalette();
  #canvas: PixelArtCanvas | undefined;
  #pendingPayload: SelectionGhostPayload | undefined;
  #rafHandle: number | undefined;
  #ghostLeaser: PeerGhostLeaser;

  #onSelectionProgress = (
    event: SelectionProgressEvent
  ): void => {
    this.#reportLocal(event);
  };

  #onSelectionCommitted = (): void => {
    // Drop queued ticks after commit so cleared ghosts cannot reappear.
    this.#cancelPending();
  };

  #onSelectionIdle = (): void => {
    // No command follows, so clear presence without waiting for timeout.
    this.#cancelPending();
    this.#room.updatePresence({
      [kPresenceSelectionKey]: null
    });
  };

  #onPeerLeft = (
    event: network.RoomPeerEvent
  ): void => {
    this.#ghostLeaser.cancel(event.clientId);
    this.#removePeerGhosts(event.clientId);
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
      this.#canvas?.peerPresence.selectionOutlines.clearAll();
      this.#canvas?.peerPresence.floatingSelections.clearAll();
    }
  };

  constructor(
    options: SelectionGhostSyncOptions
  ) {
    this.#room = options.room;
    this.#enableGhostPreview = options.enableGhostPreview ?? true;
    this.#ghostLeaser = new PeerGhostLeaser({
      onExpire: (clientId) => this.#removePeerGhosts(clientId)
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
      this.#canvas.peerPresence.selectionOutlines.clearAll();
      this.#canvas.peerPresence.floatingSelections.clearAll();
    }
    this.#canvas.selectionEvents.off(
      "selection-progress",
      this.#onSelectionProgress
    );
    this.#canvas.selectionEvents.off(
      "selection-committed",
      this.#onSelectionCommitted
    );
    this.#canvas.selectionEvents.off(
      "selection-idle",
      this.#onSelectionIdle
    );
    this.#canvas = undefined;
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

  #removePeerGhosts(
    clientId: string
  ): void {
    this.#canvas?.peerPresence.selectionOutlines.remove(clientId);
    this.#canvas?.peerPresence.floatingSelections.remove(clientId);
  }

  #reportLocal(
    payload: SelectionGhostPayload
  ): void {
    this.#pendingPayload = payload;
    if (this.#rafHandle !== undefined) {
      return;
    }

    this.#rafHandle = requestAnimationFrame(() => {
      this.#rafHandle = undefined;
      if (this.#pendingPayload) {
        this.#room.updatePresence({
          [kPresenceSelectionKey]: this.#pendingPayload
        });
      }
    });
  }

  #cancelPending(): void {
    if (this.#rafHandle !== undefined) {
      cancelAnimationFrame(this.#rafHandle);
      this.#rafHandle = undefined;
    }
    this.#pendingPayload = undefined;
  }

  #reconcileCommand(
    command: PixelNetworkCommand
  ): void {
    if (!this.#canvas) {
      return;
    }

    switch (command.action) {
      case "select-edit":
        this.#canvas.peerPresence.selectionOutlines.removeOverlapping(
          command.metadata.positions
        );
        this.#canvas.peerPresence.floatingSelections.removeOverlapping(
          command.metadata.positions
        );
        break;
      case "global-fill":
      case "resized":
      case "texture-replaced":
        // Whole-canvas ops have no positions; clear all ghosts.
        this.#ghostLeaser.clear();
        this.#canvas.peerPresence.selectionOutlines.clearAll();
        this.#canvas.peerPresence.floatingSelections.clearAll();
        break;
      default:
        break;
    }
  }

  #applyPresencePatch(
    clientId: string,
    patch: network.PeerMetadata
  ): void {
    if (!this.#canvas || !(kPresenceSelectionKey in patch)) {
      return;
    }

    const value = patch[kPresenceSelectionKey];
    if (value === null) {
      this.#ghostLeaser.cancel(clientId);
      this.#removePeerGhosts(clientId);

      return;
    }

    if (!isSelectionGhostPayload(value)) {
      return;
    }

    const color = this.#palette.forKey(clientId);
    if (value.phase === "creating") {
      this.#canvas.peerPresence.selectionOutlines.set(clientId, {
        rect: value.rect,
        mask: null,
        color
      });
      // A new marquee has no source footprint to blank.
      this.#canvas.peerPresence.floatingSelections.remove(
        clientId
      );
      this.#ghostLeaser.renew(clientId);

      return;
    }

    this.#canvas.peerPresence.selectionOutlines.set(clientId, {
      rect: value.liveRect,
      mask: value.mask,
      color
    });
    this.#canvas.peerPresence.floatingSelections.set(clientId, {
      sourceRect: value.sourceRect,
      liveRect: value.liveRect,
      mask: value.mask,
      blankSource: value.blankSource
    });
    this.#ghostLeaser.renew(clientId);
  }
}
