// Import Internal Dependencies
import type { TreeBadge } from "../data/tree/contract.ts";
import {
  samePeer,
  type PresencePeer
} from "./PresencePeer.ts";

// CONSTANTS
const kMaxBadges = 3;
const kNoPeers: readonly PresencePeer[] = Object.freeze([]);

export type PeerMark<TKey> = readonly [peer: PresencePeer, key: TKey];

export class PeerMarks<TKey> implements Iterable<PeerMark<TKey>> {
  #byClient = new Map<string, PeerMark<TKey>>();
  #byKey = new Map<TKey, PresencePeer[]>();

  constructor(
    marks: Iterable<PeerMark<TKey>> = []
  ) {
    for (const mark of marks) {
      if (!this.#byClient.has(mark[0].clientId)) {
        this.#byClient.set(mark[0].clientId, mark);
      }
    }
    for (const [peer, key] of this.#byClient.values()) {
      const peers = this.#byKey.get(key);
      if (peers === undefined) {
        this.#byKey.set(key, [peer]);
      }
      else {
        peers.push(peer);
      }
    }
  }

  get size(): number {
    return this.#byClient.size;
  }

  keys(): IterableIterator<TKey> {
    return this.#byKey.keys();
  }

  peersAt(
    key: TKey
  ): readonly PresencePeer[] {
    return this.#byKey.get(key) ?? kNoPeers;
  }

  markedBy(
    clientId: string
  ): TKey | undefined {
    return this.#byClient.get(clientId)?.[1];
  }

  badges(
    key: TKey
  ): TreeBadge[] {
    return this.peersAt(key).slice(0, kMaxBadges).map((peer) => {
      return {
        color: peer.color,
        title: peer.displayName
      };
    });
  }

  filter(
    predicate: (key: TKey) => boolean
  ): PeerMarks<TKey> {
    return new PeerMarks(
      [...this].filter(([, key]) => predicate(key))
    );
  }

  prepend(
    peer: PresencePeer,
    key: TKey
  ): PeerMarks<TKey> {
    return new PeerMarks([
      [peer, key],
      ...this
    ]);
  }

  equals(
    other: PeerMarks<TKey>
  ): boolean {
    if (this.size !== other.size) {
      return false;
    }

    for (const [clientId, [peer, key]] of this.#byClient) {
      const mark = other.#byClient.get(clientId);
      if (mark === undefined || mark[1] !== key || !samePeer(mark[0], peer)) {
        return false;
      }
    }

    return true;
  }

  [Symbol.iterator](): IterableIterator<PeerMark<TKey>> {
    return this.#byClient.values();
  }
}
