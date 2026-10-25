// Import Third-party Dependencies
import type { PresencePeer } from "@jolly-pixel/ui";
import type { PeerMarkMap } from "@jolly-pixel/ui/network";
import { Emitter } from "@openally/emitt";

export type PresenceStoreEvents = {
  peersChange: (peers: readonly PresencePeer[]) => void;
  selectionsChange: (marks: PeerMarkMap<string>) => void;
};

export class PresenceStore extends Emitter<PresenceStoreEvents> {
  #peers: readonly PresencePeer[] = [];
  #selections: PeerMarkMap<string> = new Map();

  get peers(): readonly PresencePeer[] {
    return this.#peers;
  }

  set peers(
    peers: Iterable<PresencePeer>
  ) {
    this.#peers = [...peers];
    this.emit("peersChange", this.#peers);
  }

  get selections(): PeerMarkMap<string> {
    return this.#selections;
  }

  set selections(
    marks: PeerMarkMap<string>
  ) {
    this.#selections = marks;
    this.emit("selectionsChange", marks);
  }
}
