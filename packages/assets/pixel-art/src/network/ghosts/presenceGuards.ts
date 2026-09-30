// Import Third-party Dependencies
import type {
  RGBA8,
  SelectionRect
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type {
  StrokeGhostFrame,
  StrokeGhostSpan
} from "../types.ts";

export function isSelectionRect(
  value: unknown
): value is SelectionRect {
  return typeof value === "object" &&
    value !== null &&
    "x" in value &&
    "y" in value &&
    "width" in value &&
    "height" in value &&
    Number.isFinite(value.x) &&
    Number.isFinite(value.y) &&
    Number.isFinite(value.width) &&
    Number.isFinite(value.height);
}

export function isRGBA8(
  value: unknown
): value is RGBA8 {
  return typeof value === "object" &&
    value !== null &&
    "r" in value &&
    "g" in value &&
    "b" in value &&
    "a" in value &&
    Number.isFinite(value.r) &&
    Number.isFinite(value.g) &&
    Number.isFinite(value.b) &&
    Number.isFinite(value.a);
}

export function isStrokeGhostFrame(
  value: unknown
): value is StrokeGhostFrame {
  return typeof value === "object" &&
    value !== null &&
    "from" in value &&
    "spans" in value &&
    typeof value.from === "number" &&
    Number.isInteger(value.from) &&
    value.from >= 0 &&
    Array.isArray(value.spans) &&
    value.spans.every(isStrokeGhostSpan);
}

function isStrokeGhostSpan(
  value: unknown
): value is StrokeGhostSpan {
  return typeof value === "object" &&
    value !== null &&
    "color" in value &&
    "xy" in value &&
    isRGBA8(value.color) &&
    Array.isArray(value.xy) &&
    value.xy.length % 2 === 0 &&
    value.xy.every(Number.isInteger);
}

export function isBooleanArray(
  value: unknown
): value is boolean[] {
  return Array.isArray(value) &&
    value.every((item) => typeof item === "boolean");
}
