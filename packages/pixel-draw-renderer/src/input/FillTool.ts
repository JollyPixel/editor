// Import Internal Dependencies
import type { DefaultPixelBuffer, RGBA, Vec2 } from "../types.ts";

/**
 * Computes the connected region of same-colored pixels reachable from a seed
 * point (paint-bucket flood fill). Pure algorithm with no DOM coupling —
 * callers own reading the seed color, committing the result to a buffer, and
 * any network/hook emission (see CanvasManager).
 */
export class FillTool {
  /**
   * 4-directional (orthogonal) flood fill starting at `seed`, matching every
   * pixel whose RGBA exactly equals the seed pixel's current color. Returns
   * an empty array when the seed is out of bounds or already matches
   * `fillColor` (nothing would visibly change).
   */
  static floodFill(
    buffer: DefaultPixelBuffer,
    seed: Vec2,
    fillColor: RGBA
  ): Vec2[] {
    const size = buffer.getSize();
    if (seed.x < 0 || seed.x >= size.x || seed.y < 0 || seed.y >= size.y) {
      return [];
    }

    const [tr, tg, tb, ta] = buffer.samplePixel(seed.x, seed.y);
    if (tr === fillColor.r && tg === fillColor.g && tb === fillColor.b && ta === fillColor.a) {
      return [];
    }

    const visited = new Set<string>();
    const positions: Vec2[] = [];
    const stack: Vec2[] = [seed];

    while (stack.length > 0) {
      const point = stack.pop()!;
      const key = `${point.x},${point.y}`;
      if (visited.has(key)) {
        continue;
      }
      if (point.x < 0 || point.x >= size.x || point.y < 0 || point.y >= size.y) {
        continue;
      }

      const [r, g, b, a] = buffer.samplePixel(point.x, point.y);
      if (r !== tr || g !== tg || b !== tb || a !== ta) {
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
}
