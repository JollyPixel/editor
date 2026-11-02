// Import Internal Dependencies
import type {
  PeerPlayhead,
  PlayheadTag
} from "../../collaboration/Playheads.ts";

// CONSTANTS
export const PLAYHEAD_TAG_WIDTH = 96;
export const PLAYHEAD_TAG_HEIGHT = 16;

const kMaxLabels = 3;

export interface PlayheadTags {
  readonly row: number;
  readonly flipped: boolean;
  readonly labels: readonly PlayheadTag[];
}

interface Span {
  readonly start: number;
  readonly end: number;
  readonly top: number;
}

export class TagStack {
  static #labels(
    tags: readonly PlayheadTag[]
  ): readonly PlayheadTag[] {
    if (tags.length <= kMaxLabels) {
      return tags;
    }

    const shown = tags.slice(0, kMaxLabels - 1);

    return [
      ...shown,
      {
        key: "more",
        name: `+${tags.length - shown.length}`,
        color: null
      }
    ];
  }

  #width: number;

  constructor(
    width: number
  ) {
    this.#width = width;
  }

  arrange(
    playheads: readonly PeerPlayhead[]
  ): PlayheadTags[] {
    const spans: Span[] = [];

    return playheads.map((playhead) => {
      const labels = TagStack.#labels(playhead.tags);
      const x = playhead.position * this.#width;
      const flipped = x + PLAYHEAD_TAG_WIDTH > this.#width;
      const start = flipped ? x - PLAYHEAD_TAG_WIDTH : x;
      const end = start + PLAYHEAD_TAG_WIDTH;
      const row = spans
        .filter((span) => span.start < end && start < span.end)
        .reduce((top, span) => Math.max(top, span.top), 0);
      spans.push({
        start,
        end,
        top: row + labels.length
      });

      return {
        row,
        flipped,
        labels
      };
    });
  }
}
