// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import type { PresencePeer } from "@jolly-pixel/ui";
import type { PeerMarkMap } from "@jolly-pixel/ui/network";

export type PresenceStoreEvents = {
  peersChange: (
    peers: readonly PresencePeer[]
  ) => void;
  blockSelectionsChange: (
    selections: PeerMarkMap<string>
  ) => void;
};

export class PresenceStore extends Emitter<PresenceStoreEvents> {
  #peers: readonly PresencePeer[] = [];
  #blockSelections: PeerMarkMap<string> = new Map();

  get peers(): readonly PresencePeer[] {
    return this.#peers;
  }

  set peers(
    peers: Iterable<PresencePeer>
  ) {
    this.#peers = [...peers];
    this.emit(
      "peersChange",
      this.#peers
    );
  }

  get blockSelections(): PeerMarkMap<string> {
    return this.#blockSelections;
  }

  set blockSelections(
    selections: PeerMarkMap<string>
  ) {
    this.#blockSelections = selections;
    this.emit(
      "blockSelectionsChange",
      selections
    );
  }
}
