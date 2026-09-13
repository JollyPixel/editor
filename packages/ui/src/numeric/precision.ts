// CONSTANTS
const kMaxDecimals = 12;

export function decimalPlaces(
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

export function precisionOf(
  ...values: number[]
): number {
  return Math.min(
    Math.max(0, ...values.map(decimalPlaces)),
    kMaxDecimals
  );
}

export function roundToPrecision(
  value: number,
  decimals: number
): number {
  return Number(
    value.toFixed(Math.min(decimals, kMaxDecimals))
  );
}
