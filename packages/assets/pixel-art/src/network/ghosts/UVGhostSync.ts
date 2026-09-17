// Import Third-party Dependencies
import type { Room } from "@jolly-pixel/network/client";
import {
  isUVGeometry,
  isUVSlot,
  type PixelArtCanvas,
  type UVRegion
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { PeerGhostStream } from "./PeerGhostStream.ts";
import {
  peerProfile,
  type PeerColor
} from "../peerAppearance.ts";
import type {
  PixelNetworkCommand,
  PixelServerMessage,
  UVGhostPayload
} from "../types.ts";

export interface UVGhostSyncOptions {
  room: Room<PixelNetworkCommand, PixelServerMessage>;
  canvas: PixelArtCanvas;
  color: PeerColor;
  /**
   * Called with a remote peer's in-progress drag, on top of the built-in
   * SVG ghost overlay. Lets a host mirror the drag onto something else
   * (a 3D preview, for example) without waiting for the drag to commit.
   */
  onRemoteRegionDragging?: (payload: UVGhostPayload) => void;
}

function isUVGhostPayload(
  value: unknown
): value is UVGhostPayload {
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    typeof value.id !== "string" ||
    !("face" in value) ||
    !("geometry" in value)
  ) {
    return false;
  }

  return (value.face === null || isUVSlot(value.face)) &&
    isUVGeometry(value.geometry);
}

function decodeUVGhost(
  value: unknown
): UVGhostPayload | undefined {
  return isUVGhostPayload(value) ? value : undefined;
}

export class UVGhostSync {
  #room: Room<PixelNetworkCommand, PixelServerMessage>;
  #canvas: PixelArtCanvas;
  #color: PeerColor;
  #stream: PeerGhostStream<UVGhostPayload>;
  #onRemoteRegionDragging: ((payload: UVGhostPayload) => void) | undefined;

  #onRegionDragging = (
    event: UVGhostPayload
  ): void => {
    this.#stream.report({
      id: event.id,
      face: event.face,
      geometry: event.geometry
    });
  };

  #onRegionMoved = (
    event: { region: UVRegion; }
  ): void => {
    if (this.#stream.pending?.id === event.region.id) {
      this.#stream.cancelPending();
    }
  };

  #onRegionDragEnded = (
    event: { id: string; committed: boolean; }
  ): void => {
    if (this.#stream.pending?.id === event.id) {
      this.#stream.cancelPending();
    }
    if (!event.committed) {
      this.#stream.clearLocal();
    }
  };

  constructor(
    options: UVGhostSyncOptions
  ) {
    const { canvas } = options;
    const { uv } = canvas.peerPresence;

    this.#room = options.room;
    this.#canvas = canvas;
    this.#color = options.color;
    this.#onRemoteRegionDragging = options.onRemoteRegionDragging;
    this.#stream = new PeerGhostStream({
      room: options.room,
      key: "uvGhost",
      decode: decodeUVGhost,
      layer: {
        set: (clientId, payload) => {
          uv.set(clientId, {
            ...payload,
            color: this.#colorOf(clientId)
          });
          this.#onRemoteRegionDragging?.(payload);
        },
        remove: (clientId) => uv.remove(clientId),
        clearAll: () => uv.clearAll()
      },
      reconcile: (command) => this.#reconcile(command)
    });
    canvas.uv.on("region-dragging", this.#onRegionDragging);
    canvas.uv.on("region-moved", this.#onRegionMoved);
    canvas.uv.on("region-drag-ended", this.#onRegionDragEnded);
  }

  destroy(): void {
    this.#canvas.uv.off("region-dragging", this.#onRegionDragging);
    this.#canvas.uv.off("region-moved", this.#onRegionMoved);
    this.#canvas.uv.off("region-drag-ended", this.#onRegionDragEnded);
    this.#stream.destroy();
  }

  #colorOf(
    clientId: string
  ): string {
    return this.#color(clientId, peerProfile(this.#room, clientId));
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
