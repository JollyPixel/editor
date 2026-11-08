// Import Third-party Dependencies
import type {
  PeerMarks,
  PresencePeer
} from "@jolly-pixel/ui";

// CONSTANTS
const kMaxDots = 3;

export class PeerMarkView {
  static create<TKey>(
    marks: PeerMarks<TKey>,
    key: TKey
  ): PeerMarkView | null {
    const peers = marks.peersAt(key);

    return peers.length === 0 ? null : new PeerMarkView(peers);
  }

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
