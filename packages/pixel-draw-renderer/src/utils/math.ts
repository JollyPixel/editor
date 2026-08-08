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
 * Clamps a rect's width/height to `size` (minimum 1), then clamps its
 * position so the (possibly shrunk) rect stays within bounds.
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
 * Clamps a rect's position to keep it within `size`, leaving its
 * width/height untouched.
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
 * Returns the portion of `rect` inside `size`, or `null` when they do not
 * overlap.
 */
export function clipRectToBounds(
  rect: SelectionRect,
  size: Vec2
): SelectionRect | null {
  const minX = Math.max(0, rect.x);
  const minY = Math.max(0, rect.y);
  const maxX = Math.min(size.x, rect.x + rect.width);
  const maxY = Math.min(size.y, rect.y + rect.height);
  if (maxX <= minX || maxY <= minY) {
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
