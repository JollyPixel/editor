// Import Internal Dependencies
import { PeerMarks } from "./PeerMarks.ts";
import type { PresencePeer } from "./PresencePeer.ts";

export interface PeerMarkHandlers<TKey> {
  hold(
    peer: PresencePeer,
    key: TKey
  ): void;
  release(
    clientId: string
  ): void;
}

export class PeerMarkSync<TKey> {
  #handlers: PeerMarkHandlers<TKey>;
  #shown = new PeerMarks<TKey>();

  constructor(
    handlers: PeerMarkHandlers<TKey>
  ) {
    this.#handlers = handlers;
  }

  apply(
    marks: PeerMarks<TKey>
  ): void {
    for (const [peer] of this.#shown) {
      if (marks.markedBy(peer.clientId) === undefined) {
        this.#handlers.release(peer.clientId);
      }
    }
    for (const [peer, key] of marks) {
      if (this.#shown.markedBy(peer.clientId) !== key) {
        this.#handlers.hold(peer, key);
      }
    }
    this.#shown = marks;
  }
}
