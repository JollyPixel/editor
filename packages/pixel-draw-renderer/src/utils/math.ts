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
 * Whether `pos` falls within `rect` (inclusive min, exclusive max).
 */
export function pointInRect(
  pos: Vec2,
  rect: SelectionRect
): boolean {
  return pos.x >= rect.x && pos.x < rect.x + rect.width &&
    pos.y >= rect.y && pos.y < rect.y + rect.height;
}
