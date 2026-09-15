// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  peerColor,
  readUsername
} from "./identity.ts";
import type {
  PeerMark,
  PeerMarkMap
} from "./peerMarks.ts";
import type { PresenceKey } from "./presenceKeys.ts";

export interface PeerMarkTrackerOptions<
  TKey,
  ClientMessage = unknown,
  ServerMessage = unknown
> {
  room: network.Room<ClientMessage, ServerMessage>;
  presenceKey: PresenceKey;
  localKey: () => TKey | null;
  readKey: (
    value: unknown
  ) => TKey | null;
  publish: (
    marks: PeerMarkMap<TKey>
  ) => void;
}

export class PeerMarkTracker<
  TKey,
  ClientMessage = unknown,
  ServerMessage = unknown
> {
  #room: network.Room<ClientMessage, ServerMessage>;
  #presenceKey: PresenceKey;
  #localKey: () => TKey | null;
  #readKey: (
    value: unknown
  ) => TKey | null;
  #publishMarks: (
    marks: PeerMarkMap<TKey>
  ) => void;
  #keys = new Map<string, TKey>();

  #onSync = (): void => {
    this.publishLocal();
    this.#resync();
  };

  #onPeerLeft = (
    event: network.RoomPeerEvent
  ): void => {
    if (this.#keys.delete(event.clientId)) {
      this.#publish();
    }
  };

  #onPeerPresence = (
    event: network.RoomPeerPresenceEvent
  ): void => {
    if (!(this.#presenceKey in event.patch)) {
      return;
    }

    this.#track(
      event.clientId,
      this.#readKey(event.patch[this.#presenceKey])
    );
    this.#publish();
  };

  constructor(
    options: PeerMarkTrackerOptions<TKey, ClientMessage, ServerMessage>
  ) {
    this.#room = options.room;
    this.#presenceKey = options.presenceKey;
    this.#localKey = options.localKey;
    this.#readKey = options.readKey;
    this.#publishMarks = options.publish;

    this.#room.on("sync", this.#onSync);
    this.#room.on("peer-left", this.#onPeerLeft);
    this.#room.on("peer-presence", this.#onPeerPresence);

    this.publishLocal();
    this.#resync();
  }

  publishLocal(): void {
    this.#room.updatePresence({
      [this.#presenceKey]: this.#localKey()
    });
  }

  dispose(): void {
    this.#room.off("sync", this.#onSync);
    this.#room.off("peer-left", this.#onPeerLeft);
    this.#room.off("peer-presence", this.#onPeerPresence);

    this.#keys.clear();
    this.#publishMarks(new Map());
  }

  #resync(): void {
    this.#keys.clear();
    for (const [clientId, peer] of this.#room.peers) {
      this.#track(
        clientId,
        this.#readKey(peer.presence[this.#presenceKey])
      );
    }

    this.#publish();
  }

  #track(
    clientId: string,
    key: TKey | null
  ): void {
    if (key === null) {
      this.#keys.delete(clientId);

      return;
    }

    this.#keys.set(clientId, key);
  }

  #publish(): void {
    const marks = new Map<TKey, PeerMark[]>();
    const entries = [...this.#keys]
      .sort(([left], [right]) => left.localeCompare(right));

    for (const [clientId, key] of entries) {
      const peer = this.#room.peers.get(clientId);
      if (!peer) {
        continue;
      }

      const bucket = marks.get(key) ?? [];
      bucket.push({
        clientId,
        displayName: readUsername(peer.profile),
        color: peerColor(clientId, peer.profile)
      });
      marks.set(key, bucket);
    }

    this.#publishMarks(marks);
  }
}
