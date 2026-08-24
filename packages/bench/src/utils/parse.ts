export function positiveNumber(
  raw: string
): number | null {
  const value = Number(raw);

  return Number.isFinite(value) && value > 0 ? value : null;
}
