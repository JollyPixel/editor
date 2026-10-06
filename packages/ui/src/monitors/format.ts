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
const kByteStep = 1024;
const kByteUnits: readonly string[] = ["B", "KiB", "MiB", "GiB", "TiB"];
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

export function formatBytes(
  value: number
): string {
  let scaled = value;
  let unit = 0;
  while (Math.abs(scaled) >= kByteStep && unit < kByteUnits.length - 1) {
    scaled /= kByteStep;
    unit++;
  }

  return unit === 0 ?
    `${Math.round(scaled)} B` :
    `${formatDecimal(scaled)} ${kByteUnits[unit]}`;
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
