// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import {
  PixelCursorSync,
  PixelStrokeGhostSync,
  PixelSyncClient,
  SelectionGhostSync,
  UVGhostSync,
  type PixelArtCanvas,
  type PixelNetworkCommand,
  type PixelServerMessage
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  peerColor,
  readUsername
} from "../../collaboration/identity.ts";

/**
 * Owns the network adapters attached to one pixel-art canvas.
 */
export class PixelCollaborationSession {
  #syncClient: PixelSyncClient | null = null;
  #cursorSync: PixelCursorSync | null = null;
  #uvGhostSync: UVGhostSync | null = null;
  #strokeGhostSync: PixelStrokeGhostSync | null = null;
  #selectionGhostSync: SelectionGhostSync | null = null;

  get ready(): boolean {
    return this.#syncClient?.ready === true;
  }

  attach(
    canvas: PixelArtCanvas,
    room: network.Room<PixelNetworkCommand, PixelServerMessage>
  ): void {
    this.destroy();

    this.#syncClient = new PixelSyncClient({ room });
    this.#syncClient.attach(canvas);
    this.#cursorSync = new PixelCursorSync({
      room,
      label: (identity) => readUsername(identity),
      color: (clientId, identity) => peerColor(clientId, identity)
    });
    this.#cursorSync.attach(canvas);
    this.#uvGhostSync = new UVGhostSync({ room });
    this.#uvGhostSync.attach(canvas);
    this.#strokeGhostSync = new PixelStrokeGhostSync({ room });
    this.#strokeGhostSync.attach(canvas);
    this.#selectionGhostSync = new SelectionGhostSync({ room });
    this.#selectionGhostSync.attach(canvas);
    room.join();
  }

  destroy(): void {
    this.#selectionGhostSync?.destroy();
    this.#selectionGhostSync = null;
    this.#strokeGhostSync?.destroy();
    this.#strokeGhostSync = null;
    this.#uvGhostSync?.destroy();
    this.#uvGhostSync = null;
    this.#cursorSync?.destroy();
    this.#cursorSync = null;
    this.#syncClient?.destroy();
    this.#syncClient = null;
  }
}
