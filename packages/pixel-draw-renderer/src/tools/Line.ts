// Import Internal Dependencies
import type {
  Vec2
} from "../types.ts";

export type LineCommitTrigger = "mousedown" | "mouseup";

export class Line {
  #armed = false;
  #start: Vec2 | null = null;
  #end: Vec2 | null = null;
  #commitTrigger: LineCommitTrigger = "mousedown";

  get isArmed(): boolean {
    return this.#armed;
  }

  get commitTrigger(): LineCommitTrigger {
    return this.#commitTrigger;
  }

  arm(
    start: Vec2,
    commitTrigger: LineCommitTrigger = "mousedown"
  ): void {
    this.#armed = true;
    this.#start = start;
    this.#end = start;
    this.#commitTrigger = commitTrigger;
  }

  update(
    end: Vec2
  ): void {
    if (!this.#armed) {
      return;
    }

    this.#end = end;
  }

  cancel(): void {
    this.#armed = false;
    this.#start = null;
    this.#end = null;
  }

  /**
   * Returns rasterized points without disarming the line.
   */
  get previewPoints(): Vec2[] | null {
    if (
      !this.#armed ||
      this.#start === null ||
      this.#end === null
    ) {
      return null;
    }

    return Line.rasterize(this.#start, this.#end);
  }

  /**
   * Returns rasterized points and disarms the line.
   */
  commit(): Vec2[] | null {
    const points = this.previewPoints;
    this.cancel();

    return points;
  }

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
