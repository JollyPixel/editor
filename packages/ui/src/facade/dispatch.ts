// Import Internal Dependencies
import type {
  Interval,
  JollyOption
} from "../controls/types.ts";

// CONSTANTS
const kHexColor = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;

export type DispatchTag =
  | "jolly-checkbox"
  | "jolly-color"
  | "jolly-number"
  | "jolly-range"
  | "jolly-select"
  | "jolly-slider"
  | "jolly-text";

export interface DispatchOptions<TValue> {
  min?: number;
  max?: number;
  step?: number;
  options?: Record<string, TValue>;
}

/**
 * Picks a control tag from a bound value and its `addBinding` options.
 *
 * `options.options` wins outright: any value bound alongside a choice list is
 * a select. Bounds pick `jolly-slider` over `jolly-number` only when both
 * `min` and `max` are given, matching Tweakpane's own rendering; `step` alone
 * (an unbounded field) stays a plain number.
 */
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

  throw new TypeError(
    `@jolly-pixel/ui facade: no control dispatches for this value (${typeof value})`
  );
}

/**
 * Tweakpane's `{ label: value }` record, as `JollyOption[]` for `jolly-select`.
 */
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
