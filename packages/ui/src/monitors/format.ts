export function formatCount(
  value: number
): string {
  return Math.round(
    value
  ).toLocaleString("en-US");
}

export function formatMilliseconds(
  value: number
): string {
  return `${value.toFixed(1)} ms`;
}

export function formatPercent(
  value: number
): string {
  return `${value.toFixed(1)} %`;
}
