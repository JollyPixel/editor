// Import Internal Dependencies
import type { SelectionRect, Vec2 } from "../types.ts";

export function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Clamps width/height to `size` (min 1) then clamps position to stay in bounds.
 */
export function clampRectSize(
  rect: SelectionRect,
  size: Vec2
): SelectionRect {
  const width = clamp(rect.width, 1, Math.max(1, size.x));
  const height = clamp(rect.height, 1, Math.max(1, size.y));

  return {
    width,
    height,
    x: clamp(rect.x, 0, Math.max(0, size.x - width)),
    y: clamp(rect.y, 0, Math.max(0, size.y - height))
  };
}

/**
 * Clamps rect position to stay within `size`, leaving width/height unchanged.
 */
export function clampRectPosition(
  rect: SelectionRect,
  size: Vec2
): SelectionRect {
  return {
    ...rect,
    x: clamp(rect.x, 0, Math.max(0, size.x - rect.width)),
    y: clamp(rect.y, 0, Math.max(0, size.y - rect.height))
  };
}

/**
 * Returns the portion of `rect` inside `size`, or `null` if no overlap.
 */
export function clipRectToBounds(
  rect: SelectionRect,
  size: Vec2
): SelectionRect | null {
  return intersectRects(rect, {
    x: 0,
    y: 0,
    width: size.x,
    height: size.y
  });
}

export function intersectRects(
  a: SelectionRect,
  b: SelectionRect
): SelectionRect | null {
  const minX = Math.max(a.x, b.x);
  const minY = Math.max(a.y, b.y);
  const maxX = Math.min(a.x + a.width, b.x + b.width);
  const maxY = Math.min(a.y + a.height, b.y + b.height);
  if (
    maxX <= minX ||
    maxY <= minY
  ) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

/**
 * Whether `pos` falls within `rect` (inclusive min, exclusive max).
 */
export function pointInRect(
  pos: Vec2,
  rect: SelectionRect
): boolean {
  return pos.x >= rect.x && pos.x < rect.x + rect.width &&
    pos.y >= rect.y && pos.y < rect.y + rect.height;
}

export function isVec2(
  value: unknown
): value is Vec2 {
  return typeof value === "object" && value !== null &&
    "x" in value && "y" in value &&
    typeof value.x === "number" && typeof value.y === "number";
}

export function vec2Equal(
  a: Vec2 | null,
  b: Vec2 | null
): boolean {
  if (a === null || b === null) {
    return a === b;
  }

  return a.x === b.x && a.y === b.y;
}

/**
 * Builds position keys once for reuse across a reconciliation pass.
 */
export function positionKeySet(
  positions: Vec2[]
): Set<string> {
  return new Set(
    positions.map(({ x, y }) => `${x},${y}`)
  );
}

/**
 * Matches by content because presence and command peer ids may differ.
 */
export function rectOverlapsPositionKeys(
  rect: SelectionRect,
  mask: boolean[] | null,
  committed: Set<string>
): boolean {
  for (let y = 0; y < rect.height; y++) {
    for (let x = 0; x < rect.width; x++) {
      if (mask && !mask[(y * rect.width) + x]) {
        continue;
      }

      const key = `${rect.x + x},${rect.y + y}`;
      if (committed.has(key)) {
        return true;
      }
    }
  }

  return false;
}
