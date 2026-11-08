// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import {
  PeerMarks,
  type PresencePeer
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type {
  ClipKey,
  KeyRef
} from "./animationKeys.ts";

export interface AnimateCursor {
  clip: ClipKey;
  tick: number;
  keys: readonly KeyRef[];
}

export interface PeerAnimateCursor {
  peer: PresencePeer;
  cursor: AnimateCursor;
}

export type PresenceStoreEvents = {
  peersChange: (
    peers: readonly PresencePeer[]
  ) => void;
  blockSelectionsChange: (
    selections: PeerMarks<string>
  ) => void;
  blockHoversChange: (
    hovers: PeerMarks<string>
  ) => void;
  materialEditsChange: (
    edits: PeerMarks<string>
  ) => void;
  clipFocusesChange: (
    focuses: PeerMarks<ClipKey>
  ) => void;
  animateCursorsChange: (
    cursors: readonly PeerAnimateCursor[]
  ) => void;
};

export class PresenceStore extends Emitter<PresenceStoreEvents> {
  #peers: readonly PresencePeer[] = [];
  #blockSelections = new PeerMarks<string>();
  #blockHovers = new PeerMarks<string>();
  #materialEdits = new PeerMarks<string>();
  #clipFocuses = new PeerMarks<ClipKey>();
  #animateCursors: readonly PeerAnimateCursor[] = [];

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

  get blockSelections(): PeerMarks<string> {
    return this.#blockSelections;
  }

  set blockSelections(
    selections: PeerMarks<string>
  ) {
    this.#blockSelections = selections;
    this.emit(
      "blockSelectionsChange",
      selections
    );
  }

  get blockHovers(): PeerMarks<string> {
    return this.#blockHovers;
  }

  set blockHovers(
    hovers: PeerMarks<string>
  ) {
    this.#blockHovers = hovers;
    this.emit(
      "blockHoversChange",
      hovers
    );
  }

  get materialEdits(): PeerMarks<string> {
    return this.#materialEdits;
  }

  set materialEdits(
    edits: PeerMarks<string>
  ) {
    this.#materialEdits = edits;
    this.emit(
      "materialEditsChange",
      edits
    );
  }

  get clipFocuses(): PeerMarks<ClipKey> {
    return this.#clipFocuses;
  }

  get animateCursors(): readonly PeerAnimateCursor[] {
    return this.#animateCursors;
  }

  set animateCursors(
    cursors: readonly PeerAnimateCursor[]
  ) {
    this.#animateCursors = cursors;
    this.emit(
      "animateCursorsChange",
      cursors
    );

    const focuses = new PeerMarks(
      cursors.map(({ peer, cursor }) => [peer, cursor.clip] as const)
    );
    if (!this.#clipFocuses.equals(focuses)) {
      this.#clipFocuses = focuses;
      this.emit(
        "clipFocusesChange",
        focuses
      );
    }
  }
}
