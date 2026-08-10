export interface ValueFromDeltaOptions {
  /** Value when the drag began, not the current one. */
  start: number;
  /** Pointer travel since the drag began, along the scrub axis. */
  deltaPx: number;
  step: number;
  /** Travel that advances one step. Without it a 0.01 step field is unusably twitchy. */
  pixelsPerStep?: number;
  /** Modifier scaling. The component decides which modifier means fine or coarse. */
  multiplier?: number;
  min?: number;
  max?: number;
}

/**
 * Value for a drag scrub, quantised to whole steps from `start` rather than onto an absolute grid,
 * so an off-grid value moves instead of being silently rounded.
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
 * `start + n * step` drifts, so 0.1 stepping reaches 0.30000000000000004. Rounding to the decimals
 * the inputs already carry clears it without truncating a start finer than the step.
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
