// Import Internal Dependencies
import type { SelectionRect, Vec2 } from "../types.ts";

export function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.max(
    min,
    Math.min(max, value)
  );
}

export function clampRectPosition(
  rect: SelectionRect,
  size: Vec2
): SelectionRect {
  return {
    ...rect,
    x: clamp(
      rect.x,
      0,
      Math.max(0, size.x - rect.width)
    ),
    y: clamp(
      rect.y,
      0,
      Math.max(0, size.y - rect.height)
    )
  };
}

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

export function positionKey(
  position: Vec2
): string {
  return `${position.x},${position.y}`;
}
