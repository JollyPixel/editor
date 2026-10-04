// Import Internal Dependencies
import type {
  UVResizeHandle,
  UVResizeTarget
} from "../../uv/region/layout/UVResizeTarget.ts";
import type { ScreenProjection } from "../../rendering/Viewport.ts";
import type { Vec2 } from "../../types.ts";

export interface UVResizeHit extends UVResizeTarget {
  handle: UVResizeHandle;
}

interface EdgeHit {
  end: boolean;
  distance: number;
}

// CONSTANTS
const kReach = 6;
const kHandleGrid = {
  n: { w: "nw", e: "ne", none: "n" },
  s: { w: "sw", e: "se", none: "s" },
  none: { w: "w", e: "e", none: null }
} as const satisfies Record<
  string,
  Record<string, UVResizeHandle | null>
>;

export {
  RESIZE_CURSORS as UV_RESIZE_CURSORS
} from "../../input/resizeHandles.ts";

export function resizeHandleAt(
  targets: readonly UVResizeTarget[],
  point: Vec2,
  view: ScreenProjection
): UVResizeHit | null {
  let best: { hit: UVResizeHit; inside: boolean; distance: number; } | null = null;

  for (const target of targets) {
    const { handles } = target;
    const screen = view.toScreenRect(target.rect);
    let x = edgeAt(
      point.x,
      screen.x,
      screen.width,
      handles.includes("w"),
      handles.includes("e")
    );
    let y = edgeAt(
      point.y,
      screen.y,
      screen.height,
      handles.includes("n"),
      handles.includes("s")
    );
    const corner = handleOf(y, x);
    if (x !== null && y !== null && corner !== null && !handles.includes(corner)) {
      if (x.distance <= y.distance) {
        y = null;
      }
      else {
        x = null;
      }
    }
    const insideX = within(point.x, screen.x, screen.width);
    const insideY = within(point.y, screen.y, screen.height);
    const handle = handleOf(y, x);
    if (
      handle === null ||
      (x === null && !insideX) ||
      (y === null && !insideY)
    ) {
      continue;
    }

    const inside = insideX && insideY;
    const distance = Math.min(
      x?.distance ?? Infinity,
      y?.distance ?? Infinity
    );
    if (
      best === null ||
      inside && !best.inside ||
      inside === best.inside && distance < best.distance
    ) {
      best = {
        hit: {
          ...target,
          handle
        },
        inside,
        distance
      };
    }
  }

  return best?.hit ?? null;
}

function within(
  value: number,
  start: number,
  length: number
): boolean {
  return value >= start && value <= start + length;
}

function sideOf<T extends string>(
  hit: EdgeHit | null,
  start: T,
  end: T
): T | "none" {
  if (hit === null) {
    return "none";
  }

  return hit.end ? end : start;
}

function handleOf(
  y: EdgeHit | null,
  x: EdgeHit | null
): UVResizeHandle | null {
  return kHandleGrid[sideOf(y, "n", "s")][sideOf(x, "w", "e")];
}

function edgeAt(
  value: number,
  start: number,
  length: number,
  hasStart: boolean,
  hasEnd: boolean
): EdgeHit | null {
  const inner = Math.min(kReach, length / 3);
  const toStart = value - start;
  const toEnd = start + length - value;

  if (
    hasStart &&
    toStart >= -kReach &&
    toStart <= inner &&
    toStart <= toEnd
  ) {
    return {
      end: false,
      distance: Math.abs(toStart)
    };
  }
  if (hasEnd && toEnd >= -kReach && toEnd <= inner) {
    return {
      end: true,
      distance: Math.abs(toEnd)
    };
  }

  return null;
}
