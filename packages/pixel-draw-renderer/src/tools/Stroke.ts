// Import Internal Dependencies
import type {
  BrushPainter,
  BrushPaintSource
} from "./Brush.ts";
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
  after: RGBA8;
}

export interface StrokeCover {
  positions: Vec2[];
  colors: RGBA8[];
}

export class Stroke {
  readonly source: BrushPaintSource;
  readonly #paint: BrushPainter;
  #pixels = new Map<string, StrokePixel>();
  #painted: PeerStrokePixel[] = [];

  constructor(
    source: BrushPaintSource,
    paint: BrushPainter
  ) {
    this.source = source;
    this.#paint = paint;
  }

  cover(
    positions: Iterable<Vec2>,
    buffer: Pick<DefaultPixelBuffer, "samplePixels">
  ): StrokeCover {
    const covered: StrokeCover = {
      positions: [],
      colors: []
    };
    for (const position of positions) {
      const key = positionKey(position);
      if (this.#pixels.has(key)) {
        continue;
      }

      const [before] = buffer.samplePixels([
        position
      ]);
      const after = this.#paint(before);
      this.#pixels.set(
        key,
        { position, before, after }
      );
      this.#painted.push({
        ...position,
        color: after
      });
      covered.positions.push(position);
      covered.colors.push(after);
    }

    return covered;
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
      pixels.map((pixel) => pixel.after),
      pixels.map((pixel) => pixel.before)
    );
  }
}
