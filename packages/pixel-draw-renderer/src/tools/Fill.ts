// Import Internal Dependencies
import type {
  RGBA,
  Vec2
} from "../types.ts";
import type { DefaultPixelBuffer } from "../buffer/types.ts";

export class Fill {
  static floodFill(
    buffer: DefaultPixelBuffer,
    seed: Vec2,
    fillColor: RGBA
  ): Vec2[] {
    const size = buffer.size();
    if (
      seed.x < 0 || seed.x >= size.x ||
      seed.y < 0 || seed.y >= size.y
    ) {
      return [];
    }

    const [tr, tg, tb, ta] = buffer.samplePixel(
      seed.x,
      seed.y
    );
    if (
      tr === fillColor.r &&
      tg === fillColor.g &&
      tb === fillColor.b &&
      ta === fillColor.a
    ) {
      return [];
    }

    return Fill.connectedRegion(buffer, seed);
  }

  /**
   * Uses four-connectivity from the seed pixel.
   */
  static connectedRegion(
    buffer: DefaultPixelBuffer,
    seed: Vec2
  ): Vec2[] {
    const size = buffer.size();
    if (
      seed.x < 0 || seed.x >= size.x ||
      seed.y < 0 || seed.y >= size.y
    ) {
      return [];
    }

    const [tr, tg, tb, ta] = buffer.samplePixel(
      seed.x,
      seed.y
    );

    const visited = new Set<string>();
    const positions: Vec2[] = [];
    const stack: Vec2[] = [seed];

    while (stack.length > 0) {
      const point = stack.pop()!;
      const key = `${point.x},${point.y}`;
      if (visited.has(key)) {
        continue;
      }
      if (
        point.x < 0 || point.x >= size.x ||
        point.y < 0 || point.y >= size.y
      ) {
        continue;
      }

      const [r, g, b, a] = buffer.samplePixel(
        point.x,
        point.y
      );
      if (
        r !== tr ||
        g !== tg ||
        b !== tb ||
        a !== ta
      ) {
        continue;
      }

      visited.add(key);
      positions.push(point);

      stack.push({ x: point.x + 1, y: point.y });
      stack.push({ x: point.x - 1, y: point.y });
      stack.push({ x: point.x, y: point.y + 1 });
      stack.push({ x: point.x, y: point.y - 1 });
    }

    return positions;
  }

  static matchAll(
    buffer: DefaultPixelBuffer,
    color: RGBA
  ): Vec2[] {
    const size = buffer.size();
    const positions: Vec2[] = [];

    for (let y = 0; y < size.y; y++) {
      for (let x = 0; x < size.x; x++) {
        const [r, g, b, a] = buffer.samplePixel(x, y);
        if (
          r === color.r &&
          g === color.g &&
          b === color.b &&
          a === color.a
        ) {
          positions.push({ x, y });
        }
      }
    }

    return positions;
  }
}
