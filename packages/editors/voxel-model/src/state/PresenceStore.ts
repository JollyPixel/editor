// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import type { PresencePeer } from "@jolly-pixel/ui";
import {
  peerMarks,
  type MarkedPeer,
  type PeerMarkMap
} from "@jolly-pixel/ui/network";

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
    selections: PeerMarkMap<string>
  ) => void;
  blockHoversChange: (
    hovers: PeerMarkMap<string>
  ) => void;
  materialEditsChange: (
    edits: PeerMarkMap<string>
  ) => void;
  clipFocusesChange: (
    focuses: PeerMarkMap<ClipKey>
  ) => void;
  animateCursorsChange: (
    cursors: readonly PeerAnimateCursor[]
  ) => void;
};

export class PresenceStore extends Emitter<PresenceStoreEvents> {
  #peers: readonly PresencePeer[] = [];
  #blockSelections: PeerMarkMap<string> = new Map();
  #blockHovers: PeerMarkMap<string> = new Map();
  #materialEdits: PeerMarkMap<string> = new Map();
  #clipFocuses: PeerMarkMap<ClipKey> = new Map();
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

  get blockHovers(): PeerMarkMap<string> {
    return this.#blockHovers;
  }

  set blockHovers(
    hovers: PeerMarkMap<string>
  ) {
    this.#blockHovers = hovers;
    this.emit(
      "blockHoversChange",
      hovers
    );
  }

  get materialEdits(): PeerMarkMap<string> {
    return this.#materialEdits;
  }

  set materialEdits(
    edits: PeerMarkMap<string>
  ) {
    this.#materialEdits = edits;
    this.emit(
      "materialEditsChange",
      edits
    );
  }

  get clipFocuses(): PeerMarkMap<ClipKey> {
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

    const focuses = peerMarks(
      cursors.map(({ peer, cursor }): MarkedPeer<ClipKey> => [peer, cursor.clip])
    );
    if (!sameMarks(this.#clipFocuses, focuses)) {
      this.#clipFocuses = focuses;
      this.emit(
        "clipFocusesChange",
        focuses
      );
    }
  }
}

function sameMarks<TKey>(
  left: PeerMarkMap<TKey>,
  right: PeerMarkMap<TKey>
): boolean {
  return left.size === right.size &&
    [...left].every(([key, peers]) => samePeers(peers, right.get(key) ?? []));
}

function samePeers(
  left: readonly PresencePeer[],
  right: readonly PresencePeer[]
): boolean {
  return left.length === right.length &&
    left.every((peer, index) => {
      const other = right[index];

      return peer.clientId === other.clientId &&
        peer.displayName === other.displayName &&
        peer.color === other.color;
    });
}
