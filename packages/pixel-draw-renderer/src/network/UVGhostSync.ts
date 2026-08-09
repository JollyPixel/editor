// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { ColorPalette } from "../utils/ColorPalette.ts";
import { PeerGhostLeaser } from "./PeerGhostLeaser.ts";
import type { PixelArtCanvas } from "../PixelArtCanvas.ts";
import type { UVRegion } from "../uv/UVRegion.ts";
import type {
  PixelNetworkCommand,
  PixelServerMessage,
  UVGhostPayload
} from "./types.ts";

// CONSTANTS
const kPresenceUvKey = "uvGhost";

export interface UVGhostSyncOptions {
  room: network.Room<PixelNetworkCommand, PixelServerMessage>;
  /**
   * Streams a peer's in-progress UV region drag before it commits. Costs
   * extra presence traffic and render work; disable for bandwidth-constrained
   * sessions.
   * @default true
   */
  enableGhostPreview?: boolean;
}

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
 * Broadcasts the local in-progress UV region drag over a `network.Room`'s
 * presence channel and mirrors remote peers' drags onto the attached
 * canvas's `peerUvGhosts` overlay. It never touches `UVMap` state or history.
 * A ghost clears when an authoritative command affects its region or after
 * a period of inactivity.
 */
export class UVGhostSync {
  #room: network.Room<PixelNetworkCommand, PixelServerMessage>;
  #enableGhostPreview: boolean;
  #palette = new ColorPalette();
  #canvas: PixelArtCanvas | undefined;
  #pendingPayload: UVGhostPayload | undefined;
  #rafHandle: number | undefined;
  #ghostLeaser: PeerGhostLeaser;

  #onRegionDragging = (
    event: UVGhostPayload
  ): void => {
    this.#reportLocal({
      id: event.id,
      face: event.face,
      geometry: event.geometry
    });
  };

  #onRegionMoved = (
    event: { region: UVRegion; }
  ): void => {
    // The commit for this region is already on its way to peers,
    // synchronously, ahead of any rAF-queued pre-commit tick below. Drop it
    // instead of letting it resurrect the ghost peers just saw cleared.
    if (this.#pendingPayload?.id === event.region.id) {
      this.#cancelPending();
    }
  };

  #onPeerLeft = (
    event: network.RoomPeerEvent
  ): void => {
    this.#ghostLeaser.cancel(event.clientId);
    this.#removePeerGhost(event.clientId);
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
      this.#canvas?.peerUvGhosts.clearAll();
    }
  };

  constructor(
    options: UVGhostSyncOptions
  ) {
    this.#room = options.room;
    this.#enableGhostPreview = options.enableGhostPreview ?? true;
    this.#ghostLeaser = new PeerGhostLeaser({
      onExpire: (clientId) => this.#removePeerGhost(clientId)
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
      canvas.uv.on(
        "region-dragging",
        this.#onRegionDragging
      );
      canvas.uv.on(
        "region-moved",
        this.#onRegionMoved
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
      this.#canvas.peerUvGhosts.clearAll();
    }
    this.#canvas.uv.off(
      "region-dragging",
      this.#onRegionDragging
    );
    this.#canvas.uv.off(
      "region-moved",
      this.#onRegionMoved
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

  #removePeerGhost(
    clientId: string
  ): void {
    this.#canvas?.peerUvGhosts.remove(clientId);
  }

  #reportLocal(
    payload: UVGhostPayload
  ): void {
    this.#pendingPayload = payload;
    if (this.#rafHandle !== undefined) {
      return;
    }

    this.#rafHandle = requestAnimationFrame(() => {
      this.#rafHandle = undefined;
      if (this.#pendingPayload) {
        this.#room.updatePresence({
          [kPresenceUvKey]: this.#pendingPayload
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

  /** Clears ghosts for the region changed by an accepted command. */
  #reconcileCommand(
    command: PixelNetworkCommand
  ): void {
    if (!this.#canvas) {
      return;
    }

    switch (command.action) {
      case "uv-region-moved":
      case "uv-region-deleted":
        this.#canvas.peerUvGhosts.removeByRegion(
          command.metadata.id
        );
        break;
      case "uv-region-state-changed":
        this.#canvas.peerUvGhosts.removeByRegion(
          command.metadata.region.id
        );
        break;
      default:
        break;
    }
  }

  #applyPresencePatch(
    clientId: string,
    patch: network.PeerMetadata
  ): void {
    if (!this.#canvas || !(kPresenceUvKey in patch)) {
      return;
    }

    const payload = patch[kPresenceUvKey];
    if (isUVGhostPayload(payload)) {
      this.#canvas.peerUvGhosts.set(clientId, {
        ...payload,
        color: this.#palette.forKey(clientId)
      });
      this.#ghostLeaser.renew(clientId);
    }
  }
}
