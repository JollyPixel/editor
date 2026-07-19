// Import Internal Dependencies
import { Fill } from "./Fill.ts";
import type {
  SelectionRect,
  Vec2
} from "../types.ts";
import type { DefaultPixelBuffer } from "../buffer/types.ts";

export interface ShapeSelection {
  rect: SelectionRect;
  /** Row-major, rect-relative: true where the pixel is part of the shape. */
  mask: boolean[];
}

/**
 * Computes a magic-wand-style shape selection: the 4-connected region of
 * pixels exactly matching the clicked pixel's color (see
 * Fill.connectedRegion), plus every pixel fully enclosed by that region —
 * unreachable from the region's own bounding-box border without crossing it
 * — so clicking a hollow outline selects the whole shape, border and
 * interior alike. Pure algorithm, no DOM coupling.
 */
export class ShapeSelect {
  /**
   * Returns null when the seed has no matching neighbors and the resulting
   * shape (after hole-filling) covers 1 or fewer pixels — mirrors the
   * "not 1x1" discard of a zero-drag rectangle selection.
   */
  static compute(
    buffer: DefaultPixelBuffer,
    seed: Vec2
  ): ShapeSelection | null {
    const region = Fill.connectedRegion(buffer, seed);
    if (region.length === 0) {
      return null;
    }

    const rect = ShapeSelect.#boundingRect(region);
    const mask = ShapeSelect.#fillEnclosedHoles(region, rect);

    const selectedCount = mask.reduce((count, selected) => count + (selected ? 1 : 0), 0);
    if (selectedCount <= 1) {
      return null;
    }

    return { rect, mask };
  }

  static #boundingRect(
    positions: Vec2[]
  ): SelectionRect {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const { x, y } of positions) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    };
  }

  /**
   * Builds the rect-relative mask: true for every region pixel, plus every
   * non-region pixel inside `rect` that has no path to the rect's own
   * border without crossing a region pixel (an enclosed hole). Flood-fills
   * from the rect's border cells outward-in, treating region pixels as
   * walls — whatever the border flood-fill never reaches is enclosed.
   */
  static #fillEnclosedHoles(
    region: Vec2[],
    rect: SelectionRect
  ): boolean[] {
    const { width, height } = rect;
    const isRegion = new Array<boolean>(width * height).fill(false);
    for (const { x, y } of region) {
      isRegion[((y - rect.y) * width) + (x - rect.x)] = true;
    }

    const exteriorReachable = new Array<boolean>(width * height).fill(false);
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

    return isRegion.map((selected, i) => selected || !exteriorReachable[i]);
  }
}
