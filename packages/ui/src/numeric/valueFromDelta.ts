export interface ValueFromDeltaOptions {
  /**
   * Value at drag start.
   */
  start: number;
  /**
   * Pointer travel along the scrub axis.
   */
  deltaPx: number;
  step: number;
  /**
   * Pixels per step. @default 4
   */
  pixelsPerStep?: number;
  /**
   * Fine or coarse modifier scale. @default 1
   */
  multiplier?: number;
  min?: number;
  max?: number;
}

/**
 * Returns a scrub value stepped from the drag start.
 */
export function valueFromDelta(
  options: ValueFromDeltaOptions
): number {
  const {
    start,
    deltaPx,
    step,
    pixelsPerStep = 4,
    multiplier = 1,
    min = Number.NEGATIVE_INFINITY,
    max = Number.POSITIVE_INFINITY
  } = options;

  const stepCount = Math.round(
    (deltaPx / pixelsPerStep) * multiplier
  );
  const raw = start + (stepCount * step);

  return clamp(
    round(raw, precisionOf(start, step)),
    min,
    max
  );
}

function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Limits floating-point drift to the input precision.
 */
function round(
  value: number,
  decimals: number
): number {
  return Number(
    value.toFixed(decimals)
  );
}

function precisionOf(
  start: number,
  step: number
): number {
  return Math.min(
    Math.max(
      decimalPlaces(start),
      decimalPlaces(step)
    ),
    12
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
