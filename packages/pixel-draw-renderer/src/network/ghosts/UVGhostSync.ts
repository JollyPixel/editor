// Import Internal Dependencies
import { ColorPalette } from "../../utils/ColorPalette.ts";
import {
  PeerPresenceGhostSync,
  type PeerPresenceGhostSyncOptions
} from "./PeerPresenceGhostSync.ts";
import type { PixelArtCanvas } from "../../PixelArtCanvas.ts";
import type { UVRegion } from "../../uv/UVRegion.ts";
import type {
  PixelNetworkCommand,
  UVGhostPayload
} from "../types.ts";

export type UVGhostSyncOptions = PeerPresenceGhostSyncOptions;

function isUVGhostPayload(
  value: unknown
): value is UVGhostPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "geometry" in value &&
    typeof value.geometry === "object" &&
    value.geometry !== null
  );
}

/**
 * Streams non-authoritative UV drag ghosts through presence only.
 */
export class UVGhostSync extends PeerPresenceGhostSync<UVGhostPayload> {
  protected readonly presenceKey = "uvGhost";

  #palette = new ColorPalette();

  #onRegionDragging = (
    event: UVGhostPayload
  ): void => {
    this.reportLocal({
      id: event.id,
      face: event.face,
      geometry: event.geometry
    });
  };

  #onRegionMoved = (
    event: { region: UVRegion; }
  ): void => {
    // Drop queued ticks after commit so cleared ghosts cannot reappear.
    if (this.pendingPayload?.id === event.region.id) {
      this.cancelPending();
    }
  };

  protected subscribeLocal(
    canvas: PixelArtCanvas
  ): void {
    canvas.uv.on(
      "region-dragging",
      this.#onRegionDragging
    );
    canvas.uv.on(
      "region-moved",
      this.#onRegionMoved
    );
  }

  protected unsubscribeLocal(
    canvas: PixelArtCanvas
  ): void {
    canvas.uv.off(
      "region-dragging",
      this.#onRegionDragging
    );
    canvas.uv.off(
      "region-moved",
      this.#onRegionMoved
    );
  }

  protected decodePayload(
    value: unknown
  ): UVGhostPayload | undefined {
    return isUVGhostPayload(value) ? value : undefined;
  }

  protected applyGhost(
    clientId: string,
    payload: UVGhostPayload,
    canvas: PixelArtCanvas
  ): void {
    canvas.peerPresence.uv.set(clientId, {
      ...payload,
      color: this.#palette.forKey(clientId)
    });
  }

  protected clearGhost(
    clientId: string
  ): void {
    this.canvas?.peerPresence.uv.remove(clientId);
  }

  protected clearAllGhosts(): void {
    this.canvas?.peerPresence.uv.clearAll();
  }

  protected reconcileCommand(
    command: PixelNetworkCommand
  ): void {
    if (!this.canvas) {
      return;
    }

    switch (command.action) {
      case "uv-region-moved":
      case "uv-region-deleted":
        this.canvas.peerPresence.uv.removeByRegion(
          command.metadata.id
        );
        break;
      case "uv-region-state-changed":
        this.canvas.peerPresence.uv.removeByRegion(
          command.metadata.region.id
        );
        break;
      default:
        break;
    }
  }
}
