// Import Third-party Dependencies
import type { PresencePeer } from "@jolly-pixel/ui";

// CONSTANTS
const kMaxDots = 3;
const kSelfFallbackColor = "#5b7fb8";
const kSelfFallbackName = "You";

export interface PeerMark {
  clientId: string;
  displayName: string;
  color: string;
  self?: boolean;
}

export type PeerMarkMap<TKey> = ReadonlyMap<TKey, readonly PeerMark[]>;

export class PeerMarkView {
  readonly highlight: PeerMark;
  readonly dots: readonly PeerMark[];

  constructor(
    marks: readonly PeerMark[]
  ) {
    const [highlight, ...others] = marks;

    this.highlight = highlight;
    this.dots = others.slice(0, kMaxDots);
  }

  get names(): string {
    return [this.highlight, ...this.dots]
      .map((mark) => mark.displayName)
      .join(", ");
  }
}

export class PeerMarks<TKey> {
  static selfOf(
    peers: Iterable<PresencePeer>
  ): PeerMark {
    for (const peer of peers) {
      if (peer.self) {
        return {
          clientId: peer.clientId,
          displayName: peer.displayName,
          color: peer.color,
          self: true
        };
      }
    }

    return {
      clientId: "",
      displayName: kSelfFallbackName,
      color: kSelfFallbackColor,
      self: true
    };
  }

  static withSelf<TKey>(
    peerMarks: PeerMarkMap<TKey>,
    key: TKey | null,
    peers: Iterable<PresencePeer>
  ): PeerMarks<TKey> {
    const merged = new Map<TKey, readonly PeerMark[]>(peerMarks);
    if (key !== null) {
      merged.set(key, [PeerMarks.selfOf(peers), ...merged.get(key) ?? []]);
    }

    return new PeerMarks(merged);
  }

  readonly #marks: PeerMarkMap<TKey>;

  constructor(
    marks: PeerMarkMap<TKey> = new Map()
  ) {
    this.#marks = marks;
  }

  marksOf(
    key: TKey
  ): readonly PeerMark[] {
    return this.#marks.get(key) ?? [];
  }

  viewOf(
    key: TKey
  ): PeerMarkView | null {
    const marks = this.marksOf(key);

    return marks.length === 0 ? null : new PeerMarkView(marks);
  }
}
