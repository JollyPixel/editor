// Import Internal Dependencies
import type { SelectionRect, Vec2 } from "../types.ts";

/**
 * Restricts `value` to the inclusive range [min, max].
 */
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
  const width = clamp(
    rect.width, 1, Math.max(1, size.x)
  );
  const height = clamp(
    rect.height, 1, Math.max(1, size.y)
  );

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
  const minX = Math.max(0, rect.x);
  const minY = Math.max(0, rect.y);
  const maxX = Math.min(size.x, rect.x + rect.width);
  const maxY = Math.min(size.y, rect.y + rect.height);
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
 * Position key set for cheap repeated membership checks.
 * Build once per reconciliation pass, reuse across all peer ghosts.
 */
export function positionKeySet(
  positions: Vec2[]
): Set<string> {
  return new Set(
    positions.map(({ x, y }) => `${x},${y}`)
  );
}

/**
 * Whether any cell in `rect` (masked cells only when `mask` given) falls
 * in `committed`. Content-based match because presence peer ids and command
 * ids are not guaranteed to match.
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
