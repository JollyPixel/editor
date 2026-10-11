// Import Third-party Dependencies
import type { PresencePeer } from "@jolly-pixel/ui";
import type { PeerMarkMap } from "@jolly-pixel/ui/network";

// CONSTANTS
const kMaxDots = 3;
const kSelfFallbackColor = "#5b7fb8";
const kSelfFallbackName = "You";

export class PeerMarkView {
  readonly highlight: PresencePeer;
  readonly dots: readonly PresencePeer[];

  constructor(
    marks: readonly PresencePeer[]
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
  static findSelf(
    peers: Iterable<PresencePeer>
  ): PresencePeer {
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
    const merged = new Map<TKey, readonly PresencePeer[]>(peerMarks);
    if (key !== null) {
      merged.set(key, [PeerMarks.findSelf(peers), ...merged.get(key) ?? []]);
    }

    return new PeerMarks(merged);
  }

  readonly #marks: PeerMarkMap<TKey>;

  constructor(
    marks: PeerMarkMap<TKey> = new Map()
  ) {
    this.#marks = marks;
  }

  peersFor(
    key: TKey
  ): readonly PresencePeer[] {
    return this.#marks.get(key) ?? [];
  }

  createView(
    key: TKey
  ): PeerMarkView | null {
    const marks = this.peersFor(key);

    return marks.length === 0 ? null : new PeerMarkView(marks);
  }
}
