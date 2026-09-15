// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type {
  Room,
  RoomPeerEvent,
  RoomPeerPresenceEvent
} from "./Room.ts";

export interface PresenceChannelOptions<T> {
  key: string;
  decode: (value: unknown) => T | undefined;
  equals?: (left: T, right: T) => boolean;
}

export interface PresenceChange<T> {
  clientId: string;
  value: T | undefined;
}

export type PresenceChannelEventMap<T> = {
  change: (event: PresenceChange<T>) => void;
};

export class PresenceChannel<T> extends Emitter<PresenceChannelEventMap<T>> {
  readonly key: string;

  #room: Room;
  #decode: (value: unknown) => T | undefined;
  #equals: (left: T, right: T) => boolean;
  #values = new Map<string, T>();
  #published: { value: T; } | undefined;

  #onSync = (): void => {
    for (const clientId of [...this.#values.keys()]) {
      if (!this.#room.peers.has(clientId)) {
        this.#remove(clientId);
      }
    }
    this.#replayPeers();
  };

  #onPeerJoined = (
    event: RoomPeerEvent
  ): void => {
    const peer = this.#room.peers.get(event.clientId);
    if (peer) {
      this.#apply(event.clientId, peer.presence[this.key]);
    }
  };

  #onPeerLeft = (
    event: RoomPeerEvent
  ): void => {
    this.#remove(event.clientId);
  };

  #onPeerPresence = (
    event: RoomPeerPresenceEvent
  ): void => {
    if (this.key in event.patch) {
      this.#apply(event.clientId, event.patch[this.key]);
    }
  };

  constructor(
    room: Room,
    options: PresenceChannelOptions<T>
  ) {
    super();
    this.key = options.key;
    this.#room = room;
    this.#decode = options.decode;
    this.#equals = options.equals ?? Object.is;

    room.on("sync", this.#onSync);
    room.on("peer-joined", this.#onPeerJoined);
    room.on("peer-left", this.#onPeerLeft);
    room.on("peer-presence", this.#onPeerPresence);
    this.#replayPeers();
  }

  get values(): ReadonlyMap<string, T> {
    return this.#values;
  }

  publish(
    value: T
  ): boolean {
    if (
      this.#published !== undefined &&
      this.#equals(this.#published.value, value)
    ) {
      return false;
    }

    this.#published = { value };
    this.#room.updatePresence({
      [this.key]: value
    });

    return true;
  }

  destroy(): void {
    this.#room.off("sync", this.#onSync);
    this.#room.off("peer-joined", this.#onPeerJoined);
    this.#room.off("peer-left", this.#onPeerLeft);
    this.#room.off("peer-presence", this.#onPeerPresence);

    for (const clientId of [...this.#values.keys()]) {
      this.#remove(clientId);
    }
  }

  #replayPeers(): void {
    for (const [clientId, peer] of this.#room.peers) {
      this.#apply(clientId, peer.presence[this.key]);
    }
  }

  #apply(
    clientId: string,
    raw: unknown
  ): void {
    const value = this.#decode(raw);
    if (value === undefined) {
      this.#remove(clientId);

      return;
    }

    this.#values.set(clientId, value);
    this.emit("change", {
      clientId,
      value
    });
  }

  #remove(
    clientId: string
  ): void {
    if (this.#values.delete(clientId)) {
      this.emit("change", {
        clientId,
        value: undefined
      });
    }
  }
}
