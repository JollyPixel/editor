// Import Third-party Dependencies
import {
  PresenceChannel,
  type Room
} from "@jolly-pixel/network/client";

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

export interface PeerMarkTrackerOptions<TKey> {
  room: Room;
  presenceKey: PresenceKey;
  localKey: () => TKey | null;
  readKey: (
    value: unknown
  ) => TKey | null;
  publish: (
    marks: PeerMarkMap<TKey>
  ) => void;
}

export class PeerMarkTracker<TKey> {
  #room: Room;
  #channel: PresenceChannel<TKey | null>;
  #localKey: () => TKey | null;
  #publishMarks: (
    marks: PeerMarkMap<TKey>
  ) => void;

  #publish = (): void => {
    const marks = new Map<TKey, PeerMark[]>();
    const entries = [...this.#channel.values]
      .sort(([left], [right]) => left.localeCompare(right));

    for (const [clientId, key] of entries) {
      const peer = this.#room.peers.get(clientId);
      if (!peer || key === null) {
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
  };

  constructor(
    options: PeerMarkTrackerOptions<TKey>
  ) {
    const { readKey } = options;

    this.#room = options.room;
    this.#localKey = options.localKey;
    this.#publishMarks = options.publish;
    this.#channel = new PresenceChannel<TKey | null>(options.room, {
      key: options.presenceKey,
      decode: (value) => readKey(value) ?? undefined
    });

    this.#channel.on("change", this.#publish);
    this.publishLocal();
    this.#publish();
  }

  publishLocal(): void {
    this.#channel.publish(this.#localKey());
  }

  dispose(): void {
    this.#channel.off("change", this.#publish);
    this.#channel.destroy();
    this.#publishMarks(new Map());
  }
}
