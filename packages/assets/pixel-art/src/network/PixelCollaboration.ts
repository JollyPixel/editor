// Import Third-party Dependencies
import type { Room } from "@jolly-pixel/network/client";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { PixelCursorSync } from "./PixelCursorSync.ts";
import { PixelSyncClient } from "./PixelSyncClient.ts";
import { PixelStrokeGhostSync } from "./ghosts/PixelStrokeGhostSync.ts";
import { SelectionGhostSync } from "./ghosts/SelectionGhostSync.ts";
import { UVGhostSync } from "./ghosts/UVGhostSync.ts";
import type {
  PeerColor,
  PeerLabel
} from "./peerAppearance.ts";
import type {
  PixelNetworkCommand,
  PixelServerMessage,
  UVGhostPayload
} from "./types.ts";

export interface PixelCollaborationOptions {
  room: Room<PixelNetworkCommand, PixelServerMessage>;
  canvas: PixelArtCanvas;
  label?: PeerLabel;
  color?: PeerColor;
  /**
   * See `UVGhostSyncOptions.onRemoteRegionDragging`.
   */
  onRemoteUvDragging?: (payload: UVGhostPayload) => void;
}

export class PixelCollaboration {
  readonly sync: PixelSyncClient;

  #presence: { destroy(): void; }[];

  constructor(
    options: PixelCollaborationOptions
  ) {
    const {
      room,
      canvas,
      label,
      color,
      onRemoteUvDragging
    } = options;

    this.sync = new PixelSyncClient({ room, canvas });
    this.#presence = [
      new PixelCursorSync({ room, canvas, label, color }),
      new PixelStrokeGhostSync({ room, canvas }),
      new SelectionGhostSync({ room, canvas, color }),
      new UVGhostSync({
        room,
        canvas,
        color,
        onRemoteRegionDragging: onRemoteUvDragging
      })
    ];
  }

  get ready(): boolean {
    return this.sync.ready;
  }

  destroy(): void {
    for (const presence of this.#presence) {
      presence.destroy();
    }
    this.sync.destroy();
  }
}
