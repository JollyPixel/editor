// Import Internal Dependencies
import type {
  SelectionRect,
  Vec2
} from "../types.ts";
import {
  geometryAt,
  rectOf
} from "./geometry.ts";
import type {
  UVGeometry,
  UVSlot
} from "./types.ts";

export interface UVNetCell {
  face: UVSlot;
  geometry: UVGeometry;
}

interface SkylineSegment {
  x: number;
  width: number;
  y: number;
}

interface NetPlacement {
  x: number;
  y: number;
}

interface NetLayout {
  placements: NetPlacement[];
  width: number;
  height: number;
}

/**
 * Packs the cells side by side, tallest first, and keeps the arrangement whose
 * bounding box has the smallest perimeter, then the smallest area. Cells keep
 * their own size; only their position changes.
 */
export function packNet(
  cells: readonly UVNetCell[],
  origin: Vec2
): Map<UVSlot, UVGeometry> {
  const packed = new Map<UVSlot, UVGeometry>();
  if (cells.length === 0) {
    return packed;
  }

  const rects = cells.map(
    (cell) => rectOf(cell.geometry)
  );
  const layout = bestLayout(rects);

  cells.forEach((cell, index) => {
    packed.set(
      cell.face,
      geometryAt(cell.geometry, {
        ...rects[index],
        x: origin.x + layout.placements[index].x,
        y: origin.y + layout.placements[index].y
      })
    );
  });

  return packed;
}

/**
 * Rows a shelf packer would need at worst, widest strip included, so both a
 * single row and a single column are always among the candidates.
 */
function candidateWidths(
  rects: readonly SelectionRect[],
  order: readonly number[]
): number[] {
  const widest = Math.max(
    ...rects.map((rect) => rect.width)
  );
  const widths = new Set<number>([widest]);
  let total = 0;

  for (const index of order) {
    total += rects[index].width;
    widths.add(Math.max(widest, total));
  }

  return [...widths].sort((a, b) => a - b);
}

function tallestFirst(
  rects: readonly SelectionRect[]
): number[] {
  return rects
    .map((_rect, index) => index)
    .sort(
      (a, b) => rects[b].height - rects[a].height ||
        rects[b].width - rects[a].width ||
        a - b
    );
}

function bestLayout(
  rects: readonly SelectionRect[]
): NetLayout {
  const order = tallestFirst(rects);
  let best: NetLayout | null = null;

  for (const width of candidateWidths(rects, order)) {
    const layout = packWithin(rects, order, width);
    if (layout !== null && isBetterLayout(layout, best)) {
      best = layout;
    }
  }

  return best!;
}

function isBetterLayout(
  layout: NetLayout,
  best: NetLayout | null
): boolean {
  if (best === null) {
    return true;
  }

  const perimeter = layout.width + layout.height;
  const bestPerimeter = best.width + best.height;
  if (perimeter !== bestPerimeter) {
    return perimeter < bestPerimeter;
  }

  const area = layout.width * layout.height;
  const bestArea = best.width * best.height;

  return area === bestArea ? layout.width < best.width : area < bestArea;
}

/**
 * Bottom-left skyline fill: every cell lands on the lowest free spot of the
 * strip, leftmost on a tie.
 */
function packWithin(
  rects: readonly SelectionRect[],
  order: readonly number[],
  stripWidth: number
): NetLayout | null {
  const skyline: SkylineSegment[] = [
    {
      x: 0,
      width: stripWidth,
      y: 0
    }
  ];
  const placements: NetPlacement[] = [];
  let width = 0;
  let height = 0;

  for (const index of order) {
    const rect = rects[index];
    const spot = lowestSpot(skyline, rect.width, stripWidth);
    if (spot === null) {
      return null;
    }

    placements[index] = spot;
    raiseSkyline(skyline, spot.x, spot.y + rect.height, rect.width);
    width = Math.max(width, spot.x + rect.width);
    height = Math.max(height, spot.y + rect.height);
  }

  return {
    placements,
    width,
    height
  };
}

function lowestSpot(
  skyline: readonly SkylineSegment[],
  width: number,
  stripWidth: number
): NetPlacement | null {
  let best: NetPlacement | null = null;

  for (let index = 0; index < skyline.length; index++) {
    const x = skyline[index].x;
    if (x + width > stripWidth) {
      break;
    }

    const y = topOfSpan(skyline, index, width);
    if (y !== null && (best === null || y < best.y)) {
      best = {
        x,
        y
      };
    }
  }

  return best;
}

function topOfSpan(
  skyline: readonly SkylineSegment[],
  start: number,
  width: number
): number | null {
  let covered = 0;
  let top = 0;

  for (let index = start; index < skyline.length && covered < width; index++) {
    top = Math.max(top, skyline[index].y);
    covered += skyline[index].width;
  }

  return covered < width ? null : top;
}

function raiseSkyline(
  skyline: SkylineSegment[],
  x: number,
  y: number,
  width: number
): void {
  const start = skyline.findIndex((segment) => segment.x === x);
  skyline.splice(start, 0, {
    x,
    width,
    y
  });

  const index = start + 1;
  while (index < skyline.length && skyline[index].x < x + width) {
    const segment = skyline[index];
    const overlap = x + width - segment.x;
    if (overlap < segment.width) {
      segment.x += overlap;
      segment.width -= overlap;
      break;
    }
    skyline.splice(index, 1);
  }

  mergeSkyline(skyline);
}

function mergeSkyline(
  skyline: SkylineSegment[]
): void {
  let index = 0;
  while (index < skyline.length - 1) {
    if (skyline[index].y === skyline[index + 1].y) {
      skyline[index].width += skyline[index + 1].width;
      skyline.splice(index + 1, 1);
    }
    else {
      index++;
    }
  }
}
