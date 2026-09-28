// Import Third-party Dependencies
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
  isBooleanArray,
  isSelectionRect
} from "./presenceGuards.ts";
import {
  peerStyle,
  type PeerColor,
  type PeerStyle
} from "../peerAppearance.ts";
import type {
  PixelArtRoom,
  PixelNetworkCommand,
  SelectionGhostPayload
} from "../types.ts";

export interface SelectionGhostSyncOptions {
  room: PixelArtRoom;
  canvas: PixelArtCanvas;
  color: PeerColor;
}

function isSelectionGhostPayload(
  value: unknown
): value is SelectionGhostPayload {
  if (typeof value !== "object" || value === null || !("phase" in value)) {
    return false;
  }

  if (value.phase === "creating") {
    return "rect" in value && isSelectionRect(value.rect);
  }

  if (value.phase === "moving") {
    return "sourceRect" in value &&
      "liveRect" in value &&
      "mask" in value &&
      "blankSource" in value &&
      isSelectionRect(value.sourceRect) &&
      isSelectionRect(value.liveRect) &&
      isBooleanArray(value.mask) &&
      typeof value.blankSource === "boolean";
  }

  return false;
}

function decodeSelectionGhost(
  value: unknown
): SelectionGhostPayload | undefined {
  return isSelectionGhostPayload(value) ? value : undefined;
}

export class SelectionGhostSync {
  #canvas: PixelArtCanvas;
  #colorOf: PeerStyle;
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

    this.#canvas = canvas;
    this.#colorOf = peerStyle(options.room, options.color);
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
