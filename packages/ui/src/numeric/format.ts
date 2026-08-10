// Import Internal Dependencies
import {
  evaluate,
  type EvalResult
} from "./evaluate.ts";

// CONSTANTS
const kMaxDecimals = 12;

/**
 * Formats values at the finer of the value and step precisions.
 */
export function formatNumber(
  value: number,
  step: number
): string {
  if (!Number.isFinite(value)) {
    return "";
  }

  const decimals = Math.min(
    Math.max(
      decimalPlaces(step),
      decimalPlaces(value)
    ),
    kMaxDecimals
  );

  return value.toFixed(decimals);
}

/**
 * Parses a committed draft. Blank input returns `null`.
 */
export function parseNumeric(
  text: string
): EvalResult | null {
  const trimmed = text.trim();
  if (trimmed === "") {
    return null;
  }

  return evaluate(trimmed);
}

/**
 * Quantizes and clamps a committed value.
 */
export function quantize(
  value: number,
  step: number,
  min: number,
  max: number
): number {
  const stepped = step > 0
    ? Math.round(value / step) * step
    : value;
  const clamped = Math.min(Math.max(stepped, min), max);

  return Number(
    clamped.toFixed(
      Math.min(decimalPlaces(step), kMaxDecimals)
    )
  );
}

function decimalPlaces(
  value: number
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const text = String(value);
  const exponent = text.indexOf("e-");
  if (exponent !== -1) {
    return Number(
      text.slice(exponent + 2)
    );
  }

  const dot = text.indexOf(".");

  return dot === -1 ? 0 : text.length - dot - 1;
}
