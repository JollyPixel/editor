// Import Internal Dependencies
import { positionKey } from "../../utils/math.ts";
import type {
  SelectionRect,
  Vec2
} from "../../types.ts";

export class CommittedPixels {
  readonly #keys: Set<string>;

  constructor(
    positions: Iterable<Vec2>
  ) {
    this.#keys = new Set([...positions].map(positionKey));
  }

  get isEmpty(): boolean {
    return this.#keys.size === 0;
  }

  has(
    position: Vec2
  ): boolean {
    return this.#keys.has(positionKey(position));
  }

  touches(
    rect: SelectionRect,
    mask: readonly boolean[] | null = null
  ): boolean {
    for (let y = 0; y < rect.height; y++) {
      for (let x = 0; x < rect.width; x++) {
        if (
          (mask === null || mask[(y * rect.width) + x]) &&
          this.has({ x: rect.x + x, y: rect.y + y })
        ) {
          return true;
        }
      }
    }

    return false;
  }
}
