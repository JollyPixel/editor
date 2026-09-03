// Import Internal Dependencies
import type {
  Vec2Like,
  Vec3Like,
  Vec4Like
} from "../math/types.ts";

// CONSTANTS
const kAxes: readonly string[] = ["x", "y", "z", "w"];
const kDefaultPrecision = 2;

export function formatCount(
  value: number
): string {
  return Math.round(
    value
  ).toLocaleString("en-US");
}

export function formatMilliseconds(
  value: number
): string {
  return `${value.toFixed(1)} ms`;
}

export function formatPercent(
  value: number
): string {
  return `${value.toFixed(1)} %`;
}

export function formatVector(
  value: Vec2Like | Vec3Like | Vec4Like,
  precision = kDefaultPrecision
): string {
  const record = value as unknown as Record<string, unknown>;
  const parts: string[] = [];
  for (const axis of kAxes) {
    const component = record[axis];
    if (typeof component === "number") {
      parts.push(
        String(Number(component.toFixed(precision)))
      );
    }
  }

  return parts.join(", ");
}
