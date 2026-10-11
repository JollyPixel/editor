// Import Third-party Dependencies
import type { Vector2Like } from "three";

export class DragThreshold {
  readonly distance: number;

  #origin: Vector2Like;
  #crossed = false;

  constructor(
    origin: Vector2Like,
    distance: number
  ) {
    this.#origin = {
      x: origin.x,
      y: origin.y
    };
    this.distance = distance;
  }

  crossedBy(
    position: Vector2Like
  ): boolean {
    if (!this.#crossed) {
      this.#crossed = Math.hypot(
        position.x - this.#origin.x,
        position.y - this.#origin.y
      ) >= this.distance;
    }

    return this.#crossed;
  }
}
