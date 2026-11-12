// Import Third-party Dependencies
import type { PixelEditCommand } from "@jolly-pixel/asset.pixel-art/server";
import { Color } from "@jolly-pixel/color";
import type {
  PixelDocument,
  RGBA8,
  Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// CONSTANTS
export const MAX_READ_PIXELS = 4_096;
export const MAX_STROKE_PIXELS = 16_384;

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PixelWrite extends Vec2 {
  /**
   * `"#rrggbb"` or `"#rrggbbaa"`.
   */
  color: string;
}

export interface PixelArtRegion {
  id: string;
  name: string | null;
  bounds: PixelRect;
}

export interface PixelArtSummary {
  size: Vec2;
  palette: string[];
  regions: PixelArtRegion[];
}

export interface PixelRead extends PixelRect {
  /**
   * One row per y from `y`, one `"#rrggbbaa"` per x from `x`.
   */
  rows: string[][];
}

export type PixelApply = (
  commands: readonly PixelEditCommand[]
) => Promise<void>;

interface ColorStroke {
  color: RGBA8;
  positions: Vec2[];
}

export class PixelSurface {
  #document: PixelDocument;
  #apply: PixelApply;

  constructor(
    document: PixelDocument,
    apply: PixelApply
  ) {
    this.#document = document;
    this.#apply = apply;
  }

  get size(): Vec2 {
    return this.#document.buffer.size();
  }

  get maxSize(): number {
    return this.#document.buffer.maxSize;
  }

  summary(): PixelArtSummary {
    const document = this.#document;

    return {
      size: this.size,
      palette: document.palette.toJSON().map(hexColor),
      regions: Array.from(document.uv.regions, (region) => {
        const { x, y, width, height } = region.bounds;

        return {
          id: region.id,
          name: region.name ?? null,
          bounds: {
            x,
            y,
            width,
            height
          }
        };
      })
    };
  }

  readPixels(
    rect: PixelRect
  ): PixelRead {
    this.#assertInside(rect);
    if (rect.width * rect.height > MAX_READ_PIXELS) {
      throw new RangeError(
        `Read at most ${MAX_READ_PIXELS} pixels at once, got ` +
        `${rect.width * rect.height}.`
      );
    }

    const { buffer } = this.#document;
    const rows: string[][] = [];
    for (let y = rect.y; y < rect.y + rect.height; y++) {
      const row: string[] = [];
      for (let x = rect.x; x < rect.x + rect.width; x++) {
        const [r, g, b, a] = buffer.samplePixel(x, y);
        row.push(hexColor({ r, g, b, a }));
      }
      rows.push(row);
    }

    return {
      ...rect,
      rows
    };
  }

  async paintPixels(
    writes: Iterable<PixelWrite>
  ): Promise<number> {
    const strokes = new Map<string, ColorStroke>();
    for (const { x, y, color } of writes) {
      this.#assertInside({ x, y, width: 1, height: 1 });
      const rgba = Color.from(color).toBytes();
      const key = hexColor(rgba);
      const stroke = strokes.get(key) ?? {
        color: rgba,
        positions: []
      };
      stroke.positions.push({ x, y });
      strokes.set(key, stroke);
    }

    return this.#stroke(strokes.values());
  }

  async fillRect(
    rect: PixelRect,
    color: string
  ): Promise<number> {
    this.#assertInside(rect);
    const positions: Vec2[] = [];
    for (let y = rect.y; y < rect.y + rect.height; y++) {
      for (let x = rect.x; x < rect.x + rect.width; x++) {
        positions.push({ x, y });
      }
    }

    return this.#stroke([
      {
        color: Color.from(color).toBytes(),
        positions
      }
    ]);
  }

  async replacePalette(
    colors: Iterable<string>
  ): Promise<void> {
    await this.#apply([
      {
        action: "palette-replaced",
        metadata: {
          colors: Array.from(colors, (color) => Color.from(color).toBytes())
        }
      }
    ]);
  }

  async resize(
    size: Vec2
  ): Promise<void> {
    await this.#apply([
      {
        action: "resized",
        metadata: {
          size: {
            x: size.x,
            y: size.y
          }
        }
      }
    ]);
  }

  async #stroke(
    strokes: Iterable<ColorStroke>
  ): Promise<number> {
    const commands: PixelEditCommand[] = [];
    let painted = 0;
    for (const { color, positions } of strokes) {
      for (let start = 0; start < positions.length; start += MAX_STROKE_PIXELS) {
        commands.push({
          action: "stroke",
          metadata: {
            color,
            positions: positions.slice(start, start + MAX_STROKE_PIXELS)
          }
        });
      }
      painted += positions.length;
    }
    await this.#apply(commands);

    return painted;
  }

  #assertInside(
    rect: PixelRect
  ): void {
    const size = this.#document.buffer.size();
    const inside = Number.isInteger(rect.x) && Number.isInteger(rect.y) &&
      Number.isInteger(rect.width) && Number.isInteger(rect.height) &&
      rect.width > 0 && rect.height > 0 &&
      rect.x >= 0 && rect.y >= 0 &&
      rect.x + rect.width <= size.x && rect.y + rect.height <= size.y;
    if (!inside) {
      throw new RangeError(
        `${JSON.stringify(rect)} is not a whole-pixel rect inside the ` +
        `${size.x}x${size.y} texture.`
      );
    }
  }
}

function hexColor(
  color: RGBA8
): string {
  return Color.fromBytes(color).hex(true);
}
