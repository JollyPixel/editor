// Import Third-party Dependencies
import {
  PresenceChannel,
  type PresenceChange
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type {
  PixelArtRoom,
  PixelNetworkCommand,
  PixelServerMessage
} from "../types.ts";

export interface PeerGhostLayer<T> {
  set(clientId: string, payload: T): void;
  remove(clientId: string): void;
  clearAll(): void;
}

export interface PeerGhostStreamOptions<T> {
  room: PixelArtRoom;
  key: string;
  decode: (value: unknown) => T | undefined;
  layer: PeerGhostLayer<T>;
  reconcile?: (command: PixelNetworkCommand) => void;
}

export class PeerGhostStream<T> {
  #room: PixelArtRoom;
  #channel: PresenceChannel<T | null>;
  #layer: PeerGhostLayer<T>;
  #reconcile: ((command: PixelNetworkCommand) => void) | undefined;
  #pending: T | undefined;
  #frame: number | undefined;

  #onPeerChange = (
    change: PresenceChange<T | null>
  ): void => {
    if (change.value === undefined || change.value === null) {
      this.#layer.remove(change.clientId);
    }
    else {
      this.#layer.set(change.clientId, change.value);
    }
  };

  #onMessage = (
    message: PixelServerMessage
  ): void => {
    if (message.type === "snapshot") {
      this.clearRemote();
    }
    else if (message.type === "command") {
      this.#reconcile?.(message.data);
    }
  };

  constructor(
    options: PeerGhostStreamOptions<T>
  ) {
    this.#room = options.room;
    this.#layer = options.layer;
    this.#reconcile = options.reconcile;
    this.#channel = new PresenceChannel<T | null>(options.room, {
      key: options.key,
      decode: options.decode,
      equals: () => false
    });

    for (const [clientId, payload] of this.#channel.values) {
      this.#onPeerChange({
        clientId,
        value: payload
      });
    }
    this.#channel.on("change", this.#onPeerChange);
    this.#room.on("message", this.#onMessage);
  }

  get pending(): T | undefined {
    return this.#pending;
  }

  report(
    payload: T
  ): void {
    this.#pending = payload;
    this.#frame ??= requestAnimationFrame(() => {
      this.#frame = undefined;
      if (this.#pending !== undefined) {
        this.#channel.publish(this.#pending);
      }
    });
  }

  cancelPending(): void {
    if (this.#frame !== undefined) {
      cancelAnimationFrame(this.#frame);
      this.#frame = undefined;
    }
    this.#pending = undefined;
  }

  clearLocal(): void {
    this.cancelPending();
    this.#channel.publish(null);
  }

  clearRemote(): void {
    this.#layer.clearAll();
  }

  destroy(): void {
    this.cancelPending();
    this.#room.off("message", this.#onMessage);
    this.#channel.off("change", this.#onPeerChange);
    this.#channel.destroy();
    this.clearRemote();
  }
}
