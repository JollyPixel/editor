// Import Third-party Dependencies
import {
  PeerMarks,
  type PresencePeer
} from "@jolly-pixel/ui";
import { Emitter } from "@openally/emitt";

export type PresenceStoreEvents = {
  peersChange: (peers: readonly PresencePeer[]) => void;
  selectionsChange: (marks: PeerMarks<string>) => void;
};

export class PresenceStore extends Emitter<PresenceStoreEvents> {
  #peers: readonly PresencePeer[] = [];
  #selections = new PeerMarks<string>();

  get peers(): readonly PresencePeer[] {
    return this.#peers;
  }

  set peers(
    peers: Iterable<PresencePeer>
  ) {
    this.#peers = [...peers];
    this.emit("peersChange", this.#peers);
  }

  get selections(): PeerMarks<string> {
    return this.#selections;
  }

  set selections(
    marks: PeerMarks<string>
  ) {
    this.#selections = marks;
    this.emit("selectionsChange", marks);
  }
}
