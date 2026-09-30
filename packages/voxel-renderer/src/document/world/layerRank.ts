// CONSTANTS
const kDigits = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const kRankPattern = /^[0-9A-Za-z]*[1-9A-Za-z]$/;

export interface RankedLayer {
  readonly id: string;
  readonly rank: string;
}

export function isLayerRank(
  value: unknown
): value is string {
  return typeof value === "string" && kRankPattern.test(value);
}

export function compareLayerRanks(
  left: RankedLayer,
  right: RankedLayer
): number {
  if (left.rank !== right.rank) {
    return left.rank < right.rank ? -1 : 1;
  }
  if (left.id === right.id) {
    return 0;
  }

  return left.id < right.id ? -1 : 1;
}

export function rankBetween(
  lower: string | null,
  upper: string | null
): string {
  if (lower !== null && upper !== null && lower >= upper) {
    return rankBetween(lower, null);
  }

  return midpoint(lower ?? "", upper);
}

function midpoint(
  lower: string,
  upper: string | null
): string {
  if (upper !== null) {
    let shared = 0;
    while ((lower[shared] ?? "0") === upper[shared]) {
      shared++;
    }
    if (shared > 0) {
      return upper.slice(0, shared) +
        midpoint(lower.slice(shared), upper.slice(shared));
    }
  }

  const low = lower === "" ? 0 : kDigits.indexOf(lower[0]);
  const high = upper === null ? kDigits.length : kDigits.indexOf(upper[0]);
  if (high - low > 1) {
    return kDigits[Math.round((low + high) / 2)];
  }
  if (upper !== null && upper.length > 1) {
    return upper.slice(0, 1);
  }

  return kDigits[low] + midpoint(lower.slice(1), null);
}
