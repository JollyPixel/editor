// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { PeerGhostLeaser } from "./PeerGhostLeaser.ts";
import type {
  PixelArtCanvas
} from "../../PixelArtCanvas.ts";
import type {
  PixelNetworkCommand,
  PixelServerMessage
} from "../types.ts";

export interface PeerPresenceGhostSyncOptions {
  room: network.Room<PixelNetworkCommand, PixelServerMessage>;
  /**
   * Stream in-progress peer ghosts; disable to reduce presence traffic.
   * @default true
   */
  enableGhostPreview?: boolean;
}

/**
 * Shared attach/detach lifecycle, rAF-coalesced presence reporting, and
 * peer-left/snapshot/command reconciliation for a non-authoritative ghost
 * stream. Subclasses own the payload shape, the local event source, and how
 * a decoded ghost gets written into `peerPresence`.
 */
export abstract class PeerPresenceGhostSync<TPayload> {
  #room: network.Room<PixelNetworkCommand, PixelServerMessage>;
  #enableGhostPreview: boolean;
  #canvas: PixelArtCanvas | undefined;
  #pendingPayload: TPayload | undefined;
  #rafHandle: number | undefined;
  #ghostLeaser: PeerGhostLeaser;

  #onPeerLeft = (
    event: network.RoomPeerEvent
  ): void => {
    this.#ghostLeaser.cancel(event.clientId);
    this.clearGhost(event.clientId);
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
      this.reconcileCommand(message.data);
    }
    else if (message.type === "snapshot") {
      this.#ghostLeaser.clear();
      this.clearAllGhosts();
    }
  };

  constructor(
    options: PeerPresenceGhostSyncOptions
  ) {
    this.#room = options.room;
    this.#enableGhostPreview = options.enableGhostPreview ?? true;
    this.#ghostLeaser = new PeerGhostLeaser({
      onExpire: (clientId) => this.clearGhost(clientId)
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
      this.subscribeLocal(canvas);
      for (const [clientId, peer] of this.#room.peers) {
        this.#applyPresencePatch(clientId, peer.presence);
      }
    }
  }

  detach(): void {
    const canvas = this.#canvas;
    if (!canvas) {
      return;
    }

    this.cancelPending();
    if (this.#enableGhostPreview) {
      this.#ghostLeaser.clear();
      this.clearAllGhosts();
      this.unsubscribeLocal(canvas);
    }
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

  protected get canvas(): PixelArtCanvas | undefined {
    return this.#canvas;
  }

  protected get pendingPayload(): TPayload | undefined {
    return this.#pendingPayload;
  }

  protected reportLocal(
    payload: TPayload
  ): void {
    if (this.isEmptyPayload(payload)) {
      this.cancelPending();

      return;
    }

    this.#pendingPayload = payload;
    if (this.#rafHandle !== undefined) {
      return;
    }

    this.#rafHandle = requestAnimationFrame(() => {
      this.#rafHandle = undefined;
      if (this.#pendingPayload) {
        this.#room.updatePresence({
          [this.presenceKey]: this.#pendingPayload
        });
      }
    });
  }

  protected cancelPending(): void {
    if (this.#rafHandle !== undefined) {
      cancelAnimationFrame(this.#rafHandle);
      this.#rafHandle = undefined;
    }
    this.#pendingPayload = undefined;
  }

  /**
   * Clears presence for this ghost stream without waiting for the leaser
   * timeout, for a local gesture that ended without a command to reconcile.
   */
  protected clearPresence(): void {
    this.#room.updatePresence({
      [this.presenceKey]: null
    });
  }

  protected clearLeases(): void {
    this.#ghostLeaser.clear();
  }

  protected isEmptyPayload(
    _payload: TPayload
  ): boolean {
    return false;
  }

  protected isExplicitClear(
    _value: unknown
  ): boolean {
    return false;
  }

  protected abstract readonly presenceKey: string;
  protected abstract subscribeLocal(canvas: PixelArtCanvas): void;
  protected abstract unsubscribeLocal(canvas: PixelArtCanvas): void;
  protected abstract decodePayload(value: unknown): TPayload | undefined;
  protected abstract applyGhost(
    clientId: string,
    payload: TPayload,
    canvas: PixelArtCanvas
  ): void;
  protected abstract clearGhost(clientId: string): void;
  protected abstract clearAllGhosts(): void;
  protected abstract reconcileCommand(command: PixelNetworkCommand): void;

  #applyPresencePatch(
    clientId: string,
    patch: network.PeerMetadata
  ): void {
    const canvas = this.#canvas;
    if (!canvas || !(this.presenceKey in patch)) {
      return;
    }

    const raw = patch[this.presenceKey];
    if (this.isExplicitClear(raw)) {
      this.#ghostLeaser.cancel(clientId);
      this.clearGhost(clientId);

      return;
    }

    const payload = this.decodePayload(raw);
    if (payload === undefined) {
      return;
    }

    this.applyGhost(clientId, payload, canvas);
    this.#ghostLeaser.renew(clientId);
  }
}
