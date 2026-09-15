// Import Third-party Dependencies
import type { Room } from "@jolly-pixel/network/client";
import type {
  PixelArtCanvas,
  SelectionProgressEvent
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  PeerGhostStream,
  type PeerGhostLayer
} from "./PeerGhostStream.ts";
import {
  defaultPeerColor,
  peerProfile,
  type PeerColor
} from "../peerAppearance.ts";
import type {
  PixelNetworkCommand,
  PixelServerMessage,
  SelectionGhostPayload
} from "../types.ts";

export interface SelectionGhostSyncOptions {
  room: Room<PixelNetworkCommand, PixelServerMessage>;
  canvas: PixelArtCanvas;
  color?: PeerColor;
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

function decodeSelectionGhost(
  value: unknown
): SelectionGhostPayload | undefined {
  return isSelectionGhostPayload(value) ? value : undefined;
}

export class SelectionGhostSync {
  #room: Room<PixelNetworkCommand, PixelServerMessage>;
  #canvas: PixelArtCanvas;
  #color: PeerColor;
  #stream: PeerGhostStream<SelectionGhostPayload>;

  #onSelectionProgress = (
    event: SelectionProgressEvent
  ): void => {
    this.#stream.report(event);
  };

  #onSelectionCommitted = (): void => {
    this.#stream.cancelPending();
  };

  #onSelectionIdle = (): void => {
    this.#stream.clearLocal();
  };

  constructor(
    options: SelectionGhostSyncOptions
  ) {
    const { canvas } = options;

    this.#room = options.room;
    this.#canvas = canvas;
    this.#color = options.color ?? defaultPeerColor;
    this.#stream = new PeerGhostStream({
      room: options.room,
      key: "selectionGhost",
      decode: decodeSelectionGhost,
      layer: this.#layer(),
      reconcile: (command) => this.#reconcile(command)
    });
    canvas.selectionEvents.on("selection-progress", this.#onSelectionProgress);
    canvas.selectionEvents.on("selection-committed", this.#onSelectionCommitted);
    canvas.selectionEvents.on("selection-idle", this.#onSelectionIdle);
  }

  destroy(): void {
    const { selectionEvents } = this.#canvas;

    selectionEvents.off("selection-progress", this.#onSelectionProgress);
    selectionEvents.off("selection-committed", this.#onSelectionCommitted);
    selectionEvents.off("selection-idle", this.#onSelectionIdle);
    this.#stream.destroy();
  }

  #layer(): PeerGhostLayer<SelectionGhostPayload> {
    const {
      selectionOutlines,
      floatingSelections
    } = this.#canvas.peerPresence;

    return {
      set: (clientId, payload) => {
        const color = this.#colorOf(clientId);
        if (payload.phase === "creating") {
          selectionOutlines.set(clientId, {
            rect: payload.rect,
            mask: null,
            color
          });
          floatingSelections.remove(clientId);

          return;
        }

        selectionOutlines.set(clientId, {
          rect: payload.liveRect,
          mask: payload.mask,
          color
        });
        floatingSelections.set(clientId, {
          sourceRect: payload.sourceRect,
          liveRect: payload.liveRect,
          mask: payload.mask,
          blankSource: payload.blankSource
        });
      },
      remove: (clientId) => {
        selectionOutlines.remove(clientId);
        floatingSelections.remove(clientId);
      },
      clearAll: () => {
        selectionOutlines.clearAll();
        floatingSelections.clearAll();
      }
    };
  }

  #colorOf(
    clientId: string
  ): string {
    return this.#color(clientId, peerProfile(this.#room, clientId));
  }

  #reconcile(
    command: PixelNetworkCommand
  ): void {
    const {
      selectionOutlines,
      floatingSelections
    } = this.#canvas.peerPresence;

    switch (command.action) {
      case "select-edit":
        selectionOutlines.removeOverlapping(command.metadata.positions);
        floatingSelections.removeOverlapping(command.metadata.positions);
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
