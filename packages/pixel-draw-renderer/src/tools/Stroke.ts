// Import Internal Dependencies
import type { BrushPaintSource } from "./Brush.ts";
import type { DefaultPixelBuffer } from "../buffer/types.ts";
import type { PixelDocument } from "../PixelDocument.ts";
import { positionKey } from "../utils/math.ts";
import type {
  PeerStrokePixel,
  RGBA8,
  Vec2
} from "../types.ts";

interface StrokePixel {
  position: Vec2;
  before: RGBA8;
}

export class Stroke {
  readonly source: BrushPaintSource;
  readonly color: RGBA8;
  #pixels = new Map<string, StrokePixel>();
  #painted: PeerStrokePixel[] = [];

  constructor(
    source: BrushPaintSource,
    color: RGBA8
  ) {
    this.source = source;
    this.color = color;
  }

  cover(
    positions: Iterable<Vec2>,
    buffer: Pick<DefaultPixelBuffer, "samplePixels">
  ): void {
    for (const position of positions) {
      const key = positionKey(position);
      if (this.#pixels.has(key)) {
        continue;
      }

      const [before] = buffer.samplePixels([
        position
      ]);
      this.#pixels.set(
        key,
        { position, before }
      );
      this.#painted.push({
        ...position,
        color: this.color
      });
    }
  }

  paintedPixels(): PeerStrokePixel[] {
    return this.#painted.slice();
  }

  recordTo(
    document: Pick<PixelDocument, "recordStroke">
  ): void {
    const pixels = [
      ...this.#pixels.values()
    ];

    document.recordStroke(
      pixels.map((pixel) => pixel.position),
      this.color,
      pixels.map((pixel) => pixel.before)
    );
  }
}
