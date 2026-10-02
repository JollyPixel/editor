// Import Third-party Dependencies
import {
  isUVLayoutData,
  isUVSlot,
  UVRegion,
  type PixelArtCanvas,
  type UVSlot
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { PeerGhostStream } from "./PeerGhostStream.ts";
import {
  peerStyle,
  type PeerColor,
  type PeerStyle
} from "../peerAppearance.ts";
import type {
  PixelArtRoom,
  PixelNetworkCommand,
  UVGhostPayload
} from "../types.ts";

export interface UVGhostSyncOptions {
  room: PixelArtRoom;
  canvas: PixelArtCanvas;
  color: PeerColor;
  onRemoteRegionDragging?: (region: UVRegion) => void;
}

function isUVGhostPayload(
  value: unknown
): value is UVGhostPayload {
  return typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "face" in value &&
    (value.face === null || isUVSlot(value.face)) &&
    "layout" in value &&
    isUVLayoutData(value.layout);
}

function decodeUVGhost(
  value: unknown
): UVGhostPayload | undefined {
  return isUVGhostPayload(value) ? value : undefined;
}

export class UVGhostSync {
  #canvas: PixelArtCanvas;
  #colorOf: PeerStyle;
  #stream: PeerGhostStream<UVGhostPayload>;
  #onRemoteRegionDragging: ((region: UVRegion) => void) | undefined;

  #onRegionDragging = (
    event: { region: UVRegion; face: UVSlot | null; }
  ): void => {
    this.#stream.report({
      id: event.region.id,
      face: event.face,
      layout: event.region.toLayout()
    });
  };

  #onRegionCommitted = (
    event: { region: UVRegion; }
  ): void => {
    if (this.#stream.pending?.id === event.region.id) {
      this.#stream.cancelPending();
    }
  };

  #onRegionDragEnded = (): void => {
    this.#stream.clearLocal();
  };

  constructor(
    options: UVGhostSyncOptions
  ) {
    const { canvas } = options;
    const { uv } = canvas.peerPresence;

    this.#canvas = canvas;
    this.#colorOf = peerStyle(options.room, options.color);
    this.#onRemoteRegionDragging = options.onRemoteRegionDragging;
    this.#stream = new PeerGhostStream({
      room: options.room,
      key: "uvGhost",
      decode: decodeUVGhost,
      layer: {
        set: (clientId, payload) => {
          const color = this.#colorOf(clientId);
          const region = UVRegion.fromLayout(payload.layout, {
            id: payload.id,
            color
          });
          uv.set(clientId, {
            region,
            face: payload.face,
            color
          });
          this.#onRemoteRegionDragging?.(region);
        },
        remove: (clientId) => uv.remove(clientId),
        clearAll: () => uv.clearAll()
      },
      reconcile: (command) => this.#reconcile(command)
    });
    canvas.uv.on("region-dragging", this.#onRegionDragging);
    canvas.uv.on("region-moved", this.#onRegionCommitted);
    canvas.uv.on("region-state-changed", this.#onRegionCommitted);
    canvas.uv.on("region-drag-ended", this.#onRegionDragEnded);
  }

  destroy(): void {
    this.#canvas.uv.off("region-dragging", this.#onRegionDragging);
    this.#canvas.uv.off("region-moved", this.#onRegionCommitted);
    this.#canvas.uv.off("region-state-changed", this.#onRegionCommitted);
    this.#canvas.uv.off("region-drag-ended", this.#onRegionDragEnded);
    this.#stream.destroy();
  }

  #reconcile(
    command: PixelNetworkCommand
  ): void {
    const { uv } = this.#canvas.peerPresence;

    switch (command.action) {
      case "uv-region-moved":
      case "uv-region-deleted":
        uv.removeByRegion(command.metadata.id);
        break;
      case "uv-region-state-changed":
        uv.removeByRegion(command.metadata.region.id);
        break;
      default:
        break;
    }
  }
}
