// Import Internal Dependencies
import type {
  Interval,
  JollyOption
} from "../controls/types.ts";
import {
  isVec2Like,
  isVec3Like,
  isVec4Like
} from "../math/guards.ts";

// CONSTANTS
const kHexColor = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;
const kMathTags: readonly DispatchTag[] = [
  "jolly-point2d",
  "jolly-quaternion",
  "jolly-vector2",
  "jolly-vector3",
  "jolly-vector4"
];

export type DispatchTag =
  | "jolly-checkbox"
  | "jolly-color"
  | "jolly-number"
  | "jolly-point2d"
  | "jolly-quaternion"
  | "jolly-range"
  | "jolly-select"
  | "jolly-slider"
  | "jolly-text"
  | "jolly-vector2"
  | "jolly-vector3"
  | "jolly-vector4";

export type DispatchView = "point2d" | "quaternion";

export interface DispatchOptions<TValue> {
  min?: number;
  max?: number;
  step?: number;
  options?: Record<string, TValue>;
  view?: DispatchView;
  /**
   * Adds an alpha channel to a color field and switches its output to
   * `#rrggbbaa`. Defaults to on when the bound value is already eight digits.
   */
  alpha?: boolean;
  /*
   * Per-axis accessible names for a vector field, e.g. `{ x: "pitch" }`.
   */
  axisLabels?: Record<string, string>;
}

export function dispatchTag<TValue>(
  value: TValue,
  options: DispatchOptions<TValue> = {}
): DispatchTag {
  if (options.options !== undefined) {
    return "jolly-select";
  }
  if (typeof value === "boolean") {
    return "jolly-checkbox";
  }
  if (typeof value === "number") {
    return options.min !== undefined && options.max !== undefined
      ? "jolly-slider"
      : "jolly-number";
  }
  if (typeof value === "string") {
    return kHexColor.test(value) ? "jolly-color" : "jolly-text";
  }
  if (isInterval(value)) {
    return "jolly-range";
  }
  if (isVec4Like(value)) {
    return options.view === "quaternion"
      ? "jolly-quaternion"
      : "jolly-vector4";
  }
  if (isVec3Like(value)) {
    return "jolly-vector3";
  }
  if (isVec2Like(value)) {
    return options.view === "point2d"
      ? "jolly-point2d"
      : "jolly-vector2";
  }

  throw new TypeError(
    `@jolly-pixel/ui facade: no control dispatches for this value (${typeof value})`
  );
}

export function isMathTag(
  tag: DispatchTag
): boolean {
  return kMathTags.includes(tag);
}

export function toJollyOptions<TValue>(
  record: Record<string, TValue>
): JollyOption<TValue>[] {
  return Object.entries(record).map(([label, optionValue]) => {
    return {
      value: optionValue,
      label
    };
  });
}

function isInterval(
  value: unknown
): value is Interval {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (!("from" in value) || !("to" in value)) {
    return false;
  }

  return typeof value.from === "number" && typeof value.to === "number";
}
