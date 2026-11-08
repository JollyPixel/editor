// Import Third-party Dependencies
import {
  PeerMarks,
  type PresencePeer
} from "@jolly-pixel/ui";
import { Emitter } from "@openally/emitt";

export type PresenceStoreEvents = {
  peersChange: (
    peers: readonly PresencePeer[]
  ) => void;
  blockSelectionsChange: (
    selections: PeerMarks<number>
  ) => void;
  layerSelectionsChange: (
    selections: PeerMarks<string>
  ) => void;
};

export class PresenceStore extends Emitter<PresenceStoreEvents> {
  #peers: readonly PresencePeer[] = [];
  #blockSelections = new PeerMarks<number>();
  #layerSelections = new PeerMarks<string>();

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

  get blockSelections(): PeerMarks<number> {
    return this.#blockSelections;
  }

  set blockSelections(
    selections: PeerMarks<number>
  ) {
    this.#blockSelections = selections;
    this.emit(
      "blockSelectionsChange",
      selections
    );
  }

  get layerSelections(): PeerMarks<string> {
    return this.#layerSelections;
  }

  set layerSelections(
    selections: PeerMarks<string>
  ) {
    this.#layerSelections = selections;
    this.emit(
      "layerSelectionsChange",
      selections
    );
  }
}
