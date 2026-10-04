// Import Internal Dependencies
import type {
  Vec2
} from "../types.ts";

export class Line {
  /**
   * Uses Bresenham's line algorithm.
   */
  static rasterize(
    start: Vec2,
    end: Vec2
  ): Vec2[] {
    const points: Vec2[] = [];
    let x = start.x;
    let y = start.y;
    const dx = Math.abs(end.x - x);
    const dy = -Math.abs(end.y - y);
    const sx = x < end.x ? 1 : -1;
    const sy = y < end.y ? 1 : -1;
    let err = dx + dy;

    for (;;) {
      points.push({ x, y });
      if (x === end.x && y === end.y) {
        break;
      }

      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }

    return points;
  }
}
