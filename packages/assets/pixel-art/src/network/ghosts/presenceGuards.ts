// Import Third-party Dependencies
import type {
  PeerStrokePixel,
  RGBA8,
  SelectionRect
} from "@jolly-pixel/pixel-draw.renderer";

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

export function isPeerStrokePixel(
  value: unknown
): value is PeerStrokePixel {
  return typeof value === "object" &&
    value !== null &&
    "x" in value &&
    "y" in value &&
    "color" in value &&
    Number.isInteger(value.x) &&
    Number.isInteger(value.y) &&
    isRGBA8(value.color);
}

export function isBooleanArray(
  value: unknown
): value is boolean[] {
  return Array.isArray(value) &&
    value.every((item) => typeof item === "boolean");
}
