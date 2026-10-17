// CONSTANTS
const kDefaultDeadBand = 6;

export interface DropCandidate {
  start: number;
  size: number;
}

export interface ResolveDropIndexOptions {
  /**
   * Pointer position on the same axis as the candidates.
   */
  position: number;
  /**
   * Children ordered by ascending `start`.
   */
  candidates: readonly DropCandidate[];
  /**
   * Index currently previewed, or `null` for an unbiased resolution.
   */
  current?: number | null;
  /**
   * Pixels the pointer must clear past a midpoint to leave `current`.
   */
  deadBand?: number;
}

export function resolveDropIndex(
  options: ResolveDropIndexOptions
): number {
  const {
    position,
    candidates,
    current = null,
    deadBand = kDefaultDeadBand
  } = options;

  let raw = 0;
  while (
    raw < candidates.length &&
    candidateMidpoint(candidates[raw]) < position
  ) {
    raw++;
  }

  if (
    current === null ||
    current < 0 ||
    current > candidates.length ||
    raw === current
  ) {
    return raw;
  }

  if (raw > current) {
    const boundary = candidateMidpoint(
      candidates[current]
    ) + deadBand;

    return position > boundary ? raw : current;
  }

  const boundary = candidateMidpoint(
    candidates[current - 1]
  ) - deadBand;

  return position < boundary ? raw : current;
}

function candidateMidpoint(
  candidate: DropCandidate
): number {
  return candidate.start + (candidate.size / 2);
}
