// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import * as z from "zod/mini";

// Import Internal Dependencies
import type {
  Room,
  RoomPeerEvent,
  RoomPeerPresenceEvent
} from "./Room.ts";

type PresenceDecodeFn<T> = (value: unknown) => T | undefined;

export type PresenceDecoder<T> =
  | PresenceDecodeFn<T>
  | z.core.$ZodType<T>;

export interface PresenceChannelOptions<T> {
  key: string;
  /**
   * A function returning `undefined` for an unusable value, or a zod schema
   * (classic or mini) whose failed parse counts as `undefined`.
   */
  decode: PresenceDecoder<T>;
  equals?: (left: T, right: T) => boolean;
}

function toDecodeFn<T>(
  decoder: PresenceDecoder<T>
): PresenceDecodeFn<T> {
  if (typeof decoder === "function") {
    return decoder;
  }

  return (value) => {
    const result = z.safeParse(decoder, value);

    return result.success ? result.data : undefined;
  };
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
  #decode: PresenceDecodeFn<T>;
  #equals: (left: T, right: T) => boolean;
  #values = new Map<string, T>();
  #published: { value: T; } | undefined;

  #reconcile = (): void => {
    const clientIds = new Set([
      ...this.#values.keys(),
      ...this.#room.peers.keys()
    ]);
    for (const clientId of clientIds) {
      this.#refresh(clientId);
    }
  };

  #onPeerJoined = (
    event: RoomPeerEvent
  ): void => {
    this.#refresh(event.clientId);
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
    this.#decode = toDecodeFn(options.decode);
    this.#equals = options.equals ?? Object.is;

    room.on("sync", this.#reconcile);
    room.on("left", this.#reconcile);
    room.on("peer-joined", this.#onPeerJoined);
    room.on("peer-left", this.#onPeerLeft);
    room.on("peer-presence", this.#onPeerPresence);
    this.#reconcile();
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
    this.#room.off("sync", this.#reconcile);
    this.#room.off("left", this.#reconcile);
    this.#room.off("peer-joined", this.#onPeerJoined);
    this.#room.off("peer-left", this.#onPeerLeft);
    this.#room.off("peer-presence", this.#onPeerPresence);

    for (const clientId of [...this.#values.keys()]) {
      this.#remove(clientId);
    }
  }

  #refresh(
    clientId: string
  ): void {
    const peer = this.#room.peers.get(clientId);
    if (peer === undefined) {
      this.#remove(clientId);

      return;
    }

    this.#apply(clientId, peer.presence[this.key]);
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

    const previous = this.#values.get(clientId);
    if (previous !== undefined && this.#equals(previous, value)) {
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
