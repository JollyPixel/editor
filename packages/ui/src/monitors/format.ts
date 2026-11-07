// Import Internal Dependencies
import type {
  Vec2Like,
  Vec3Like,
  Vec4Like
} from "../math/types.ts";
import { roundToPrecision } from "../numeric/precision.ts";

// CONSTANTS
const kAxes: readonly string[] = ["x", "y", "z", "w"];
const kDefaultPrecision = 2;
const kDefaultDecimals = 1;
const kCountFormat = new Intl.NumberFormat("en-US");

export function formatCount(
  value: number,
  singular?: string,
  plural = `${singular}s`
): string {
  const count = Math.round(value);
  const text = kCountFormat.format(count);
  if (singular === undefined) {
    return text;
  }

  return `${text} ${count === 1 ? singular : plural}`;
}

export function formatInteger(
  value: number
): string {
  return String(Math.round(value));
}

export function formatDecimal(
  value: number,
  decimals = kDefaultDecimals
): string {
  return value.toFixed(decimals);
}

export function formatMilliseconds(
  value: number
): string {
  return `${formatDecimal(value)} ms`;
}

export function formatPercent(
  value: number
): string {
  return `${formatDecimal(value)} %`;
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
        String(roundToPrecision(component, precision))
      );
    }
  }

  return parts.join(", ");
}
