// Import Internal Dependencies
import type { DefaultPixelBuffer } from "../buffer/types.ts";
import type {
  RGBA8,
  SelectionRect,
  Vec2
} from "../types.ts";

// CONSTANTS
const kTransparent: RGBA8 = { r: 0, g: 0, b: 0, a: 0 };

export class SelectionEraseColor {
  readonly explicit: RGBA8 | null;

  constructor(
    explicit: RGBA8 | null = null
  ) {
    this.explicit = explicit;
  }

  resolve(
    buffer: DefaultPixelBuffer,
    rect: SelectionRect
  ): RGBA8 {
    return this.explicit ?? SelectionEraseColor.#dominantBorder(
      buffer,
      rect
    );
  }

  static #dominantBorder(
    buffer: DefaultPixelBuffer,
    rect: SelectionRect
  ): RGBA8 {
    const counts = new Map<string, { color: RGBA8; count: number; }>();
    const pixels = SelectionEraseColor.#border(
      buffer.size(),
      rect
    );

    for (const color of buffer.samplePixels(pixels)) {
      const key = `${color.r},${color.g},${color.b},${color.a}`;
      const entry = counts.get(key) ?? { color, count: 0 };
      entry.count++;
      counts.set(key, entry);
    }

    let best: { color: RGBA8; count: number; } | null = null;
    for (const entry of counts.values()) {
      if (best === null || entry.count > best.count) {
        best = entry;
      }
    }

    return best?.color ?? kTransparent;
  }

  static #border(
    size: Vec2,
    rect: SelectionRect
  ): Vec2[] {
    const positions: Vec2[] = [];
    function add(
      x: number,
      y: number
    ): void {
      if (x >= 0 && x < size.x && y >= 0 && y < size.y) {
        positions.push({ x, y });
      }
    }

    for (let x = rect.x - 1; x <= rect.x + rect.width; x++) {
      add(x, rect.y - 1);
      add(x, rect.y + rect.height);
    }
    for (let y = rect.y; y < rect.y + rect.height; y++) {
      add(rect.x - 1, y);
      add(rect.x + rect.width, y);
    }

    return positions;
  }
}
