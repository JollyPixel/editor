export interface GroundPoint {
  readonly x: number;
  readonly z: number;
}

export class StampSpacer {
  #cursor: GroundPoint;
  #travelled = 0;

  constructor(
    start: GroundPoint
  ) {
    this.#cursor = start;
  }

  moveTo(
    point: GroundPoint,
    spacing: number
  ): GroundPoint[] {
    const from = this.#cursor;
    const length = Math.hypot(point.x - from.x, point.z - from.z);
    const stamps: GroundPoint[] = [];
    let remaining = length;
    while (remaining > 0 && this.#travelled + remaining >= spacing) {
      remaining -= spacing - this.#travelled;
      this.#travelled = 0;
      const along = (length - remaining) / length;
      stamps.push({
        x: from.x + (point.x - from.x) * along,
        z: from.z + (point.z - from.z) * along
      });
    }
    this.#travelled += remaining;
    this.#cursor = point;

    return stamps;
  }
}
