// Import Internal Dependencies
import {
  clamp,
  clampUnit,
  BYTE_MAX,
  wrapHue
} from "../utils.ts";

// CONSTANTS
const kNumberPattern = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
const kAnglePattern = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(deg|grad|rad|turn)?$/i;
const kMissing = "none";
const kTurn = 360;
const kGradsPerTurn = 400;
const kPercentMax = 100;

export function parseNumber(
  token: string
): number | null {
  if (!kNumberPattern.test(token)) {
    return null;
  }

  return Number(token);
}

export function parsePercent(
  token: string
): number | null {
  if (!token.endsWith("%")) {
    return null;
  }

  const value = parseNumber(token.slice(0, -1));

  return value === null ? null : value / kPercentMax;
}

/**
 * Reads percentages or byte-scale numbers and clamps to 0-1.
 */
export function parseUnitFromByte(
  token: string
): number | null {
  const ratio = parsePercent(token);
  if (ratio !== null) {
    return clampUnit(ratio);
  }

  const value = missingOr(token, parseNumber);

  return value === null ? null : clamp(value, 0, BYTE_MAX) / BYTE_MAX;
}

/**
 * Reads bare numbers as CSS percentage values and clamps to 0-1.
 */
export function parseUnitChannel(
  token: string
): number | null {
  const ratio = parsePercent(token);
  if (ratio !== null) {
    return clampUnit(ratio);
  }

  const value = missingOr(token, parseNumber);

  return value === null ? null : clampUnit(value / kPercentMax);
}

export function parseAlpha(
  token: string | null
): number | null {
  if (token === null) {
    return 1;
  }

  const ratio = parsePercent(token);
  if (ratio !== null) {
    return clampUnit(ratio);
  }

  const value = missingOr(token, parseNumber);

  return value === null ? null : clampUnit(value);
}

/**
 * Accepts CSS angle units and wraps the result to 0-360.
 */
export function parseHue(
  token: string
): number | null {
  if (token.toLowerCase() === kMissing) {
    return 0;
  }

  const match = kAnglePattern.exec(token);
  if (match === null) {
    return null;
  }

  return wrapHue(
    toDegrees(
      Number(match[1]),
      match[2]?.toLowerCase()
    )
  );
}

function toDegrees(
  value: number,
  unit: string | undefined
): number {
  switch (unit) {
    case "rad":
      return (value * kTurn) / (2 * Math.PI);
    case "turn":
      return value * kTurn;
    case "grad":
      return (value * kTurn) / kGradsPerTurn;
    default:
      return value;
  }
}

function missingOr(
  token: string,
  read: (token: string) => number | null
): number | null {
  if (token.toLowerCase() === kMissing) {
    return 0;
  }

  return read(token);
}
