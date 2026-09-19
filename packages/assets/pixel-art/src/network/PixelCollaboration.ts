// Import Third-party Dependencies
import type { Room } from "@jolly-pixel/network/client";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { PixelCursorSync } from "./PixelCursorSync.ts";
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
  label: PeerLabel;
  color: PeerColor;
  onRemoteUvDragging?: (payload: UVGhostPayload) => void;
}

export class PixelCollaboration {
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

  destroy(): void {
    for (const presence of this.#presence) {
      presence.destroy();
    }
  }
}
