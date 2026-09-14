// Import Third-party Dependencies
import type { PresencePeer } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { PeerMarkMap } from "../../collaboration/peerMarks.ts";
import { EditorStore } from "./EditorStore.ts";

export type PresenceStoreEvents = {
  peersChange: (
    peers: readonly PresencePeer[]
  ) => void;
  blockSelectionsChange: (
    selections: PeerMarkMap<string>
  ) => void;
};

export class PresenceStore extends EditorStore<PresenceStoreEvents> {
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
