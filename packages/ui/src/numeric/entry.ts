// Import Internal Dependencies
import { clamp } from "./bounds.ts";
import {
  evaluate,
  type EvalResult
} from "./evaluate.ts";
import {
  multiplierFor,
  type ModifierKeys
} from "./modifierMultiplier.ts";
import {
  decimalPlaces,
  precisionOf,
  roundToPrecision
} from "./precision.ts";
import { valueFromDelta } from "./valueFromDelta.ts";

export interface NumericBounds {
  step: number;
  min: number;
  max: number;
}

export type StepDirection = 1 | -1;

export function formatNumber(
  value: number,
  step: number
): string {
  if (!Number.isFinite(value)) {
    return "";
  }

  return value.toFixed(precisionOf(step, value));
}

export function parseNumeric(
  text: string
): EvalResult | null {
  const trimmed = text.trim();
  if (trimmed === "") {
    return null;
  }

  return evaluate(trimmed);
}

export function quantize(
  value: number,
  step: number,
  min: number,
  max: number
): number {
  const stepped = step > 0
    ? Math.round(value / step) * step
    : value;

  return roundToPrecision(
    clamp(stepped, min, max),
    decimalPlaces(step)
  );
}

export function parseNumericEntry(
  text: string,
  bounds: NumericBounds
): EvalResult | null {
  const result = parseNumeric(text);
  if (result === null || !result.ok) {
    return result;
  }

  return {
    ok: true,
    value: quantize(
      result.value,
      bounds.step,
      bounds.min,
      bounds.max
    )
  };
}

export function stepNumericEntry(
  start: number,
  direction: StepDirection,
  modifiers: ModifierKeys,
  bounds: NumericBounds
): number {
  return valueFromDelta({
    start,
    deltaPx: direction,
    step: bounds.step * multiplierFor(modifiers),
    pixelsPerStep: 1,
    min: bounds.min,
    max: bounds.max
  });
}
