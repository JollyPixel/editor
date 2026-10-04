// Import Internal Dependencies
import { filledArray } from "../utils/array.ts";
import { Fill } from "./Fill.ts";
import { RectArea } from "../utils/RectArea.ts";
import type {
  SelectionRect,
  Vec2
} from "../types.ts";
import type { DefaultPixelBuffer } from "../buffer/types.ts";

export interface ShapeSelection {
  rect: SelectionRect;
  /**
   * Row-major shape mask.
   */
  mask: boolean[];
}

export class ShapeSelect {
  static compute(
    buffer: DefaultPixelBuffer,
    seed: Vec2
  ): ShapeSelection | null {
    const region = Fill.connectedRegion(
      buffer,
      seed
    );
    const rect = RectArea.bounding(region)?.bounds;
    if (rect === undefined) {
      return null;
    }

    const mask = ShapeSelect.#fillEnclosedHoles(
      region,
      rect
    );

    const selectedCount = mask.reduce(
      (count, selected) => count + (selected ? 1 : 0),
      0
    );
    if (selectedCount <= 1) {
      return null;
    }

    return { rect, mask };
  }

  static #fillEnclosedHoles(
    region: Vec2[],
    rect: SelectionRect
  ): boolean[] {
    const { width, height } = rect;

    const isRegion = filledArray(
      width * height,
      false
    );
    for (const { x, y } of region) {
      isRegion[((y - rect.y) * width) + (x - rect.x)] = true;
    }

    const exteriorReachable = filledArray(
      width * height,
      false
    );
    const stack: Vec2[] = [];
    function seed(x: number, y: number): void {
      const idx = (y * width) + x;
      if (isRegion[idx] || exteriorReachable[idx]) {
        return;
      }
      exteriorReachable[idx] = true;
      stack.push({ x, y });
    }

    for (let x = 0; x < width; x++) {
      seed(x, 0);
      seed(x, height - 1);
    }
    for (let y = 0; y < height; y++) {
      seed(0, y);
      seed(width - 1, y);
    }

    while (stack.length > 0) {
      const { x, y } = stack.pop()!;
      if (x + 1 < width) {
        seed(x + 1, y);
      }
      if (x - 1 >= 0) {
        seed(x - 1, y);
      }
      if (y + 1 < height) {
        seed(x, y + 1);
      }
      if (y - 1 >= 0) {
        seed(x, y - 1);
      }
    }

    return isRegion.map(
      (selected, i) => selected || !exteriorReachable[i]
    );
  }
}
