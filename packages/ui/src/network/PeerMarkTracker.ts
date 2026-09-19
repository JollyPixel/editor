// Import Third-party Dependencies
import {
  PresenceChannel,
  type Room
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type { PresencePeer } from "../peer/Presence.ts";
import {
  peerProfileColor,
  readUsername
} from "./peerProfile.ts";

export type PeerMarkMap<TKey> = ReadonlyMap<TKey, readonly PresencePeer[]>;

export interface PeerMarkTrackerOptions<TKey> {
  room: Room;
  presenceKey: string;
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
    const marks = new Map<TKey, PresencePeer[]>();
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
        color: peerProfileColor(clientId, peer.profile)
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
