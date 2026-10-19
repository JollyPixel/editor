// Import Third-party Dependencies
import type { PresencePeer } from "@jolly-pixel/ui";
import { Emitter } from "@openally/emitt";

export type PresenceStoreEvents = {
  peersChange: (
    peers: readonly PresencePeer[]
  ) => void;
};

export class PresenceStore extends Emitter<PresenceStoreEvents> {
  #peers: readonly PresencePeer[] = [];

  get peers(): readonly PresencePeer[] {
    return this.#peers;
  }

  set peers(
    peers: Iterable<PresencePeer>
  ) {
    this.#peers = [...peers];
    this.emit("peersChange", this.#peers);
  }
}
