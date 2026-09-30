// Import Third-party Dependencies
import type {
  PeerStrokePixel,
  RGBA8
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type {
  StrokeGhostFrame,
  StrokeGhostSpan
} from "../types.ts";

export class StrokeGhostEncoder {
  #sent: readonly PeerStrokePixel[] = [];

  static merge(
    pending: StrokeGhostFrame,
    next: StrokeGhostFrame
  ): StrokeGhostFrame {
    if (next.from === 0) {
      return next;
    }

    return {
      from: pending.from,
      spans: [...pending.spans, ...next.spans]
    };
  }

  encode(
    pixels: readonly PeerStrokePixel[]
  ): StrokeGhostFrame | null {
    const from = this.#extends(pixels) ? this.#sent.length : 0;
    this.#sent = pixels;
    if (from > 0 && from === pixels.length) {
      return null;
    }

    return {
      from,
      spans: spansOf(pixels.slice(from))
    };
  }

  reset(): void {
    this.#sent = [];
  }

  #extends(
    pixels: readonly PeerStrokePixel[]
  ): boolean {
    const sent = this.#sent;
    if (sent.length === 0 || sent.length > pixels.length) {
      return false;
    }

    return sent.every((pixel, index) => samePixel(pixel, pixels[index]));
  }
}

function spansOf(
  pixels: readonly PeerStrokePixel[]
): StrokeGhostSpan[] {
  const spans: StrokeGhostSpan[] = [];
  let current: StrokeGhostSpan | undefined;
  for (const { x, y, color } of pixels) {
    if (current === undefined || !sameColor(current.color, color)) {
      current = {
        color,
        xy: []
      };
      spans.push(current);
    }
    current.xy.push(x, y);
  }

  return spans;
}

function samePixel(
  left: PeerStrokePixel,
  right: PeerStrokePixel
): boolean {
  return left.x === right.x &&
    left.y === right.y &&
    sameColor(left.color, right.color);
}

function sameColor(
  left: RGBA8,
  right: RGBA8
): boolean {
  return left.r === right.r &&
    left.g === right.g &&
    left.b === right.b &&
    left.a === right.a;
}
