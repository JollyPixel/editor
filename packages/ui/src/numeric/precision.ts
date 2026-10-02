// CONSTANTS
const kMaxDecimals = 12;
const kExponentialFrom = 1e21;

export function decimalPlaces(
  value: number
): number {
  if (
    !Number.isFinite(value) ||
    (Number.isInteger(value) && Math.abs(value) < kExponentialFrom)
  ) {
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

export function precisionOf(
  ...values: number[]
): number {
  let places = 0;
  for (const value of values) {
    const decimals = decimalPlaces(value);
    if (decimals > places) {
      places = decimals;
    }
  }

  return Math.min(places, kMaxDecimals);
}

export function roundToPrecision(
  value: number,
  decimals: number
): number {
  return Number(
    value.toFixed(Math.min(decimals, kMaxDecimals))
  );
}
