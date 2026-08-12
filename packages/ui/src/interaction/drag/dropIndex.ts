// CONSTANTS
const kDefaultDeadBand = 6;

/**
 * Main-axis extent of one existing child, in client pixels.
 */
export interface DropCandidate {
  start: number;
  size: number;
}

export interface ResolveDropIndexOptions {
  /** Pointer position on the same axis as the candidates. */
  position: number;
  /** Children ordered by ascending `start`. */
  candidates: readonly DropCandidate[];
  /** Index currently previewed, or `null` for an unbiased resolution. */
  current?: number | null;
  /** Pixels the pointer must clear past a midpoint to leave `current`. */
  deadBand?: number;
}

/**
 * Resolves the insertion index a pointer sits at, in `[0, candidates.length]`.
 *
 * Passing `current` adds hysteresis: the result stays on `current` until the
 * pointer clears the separating midpoint by `deadBand` pixels, so a hand
 * resting on a boundary cannot oscillate between two indices.
 */
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
    midpointOf(candidates[raw]) < position
  ) {
    raw++;
  }

  // An out-of-range `current` describes a stale list, so it carries no bias.
  if (
    current === null ||
    current < 0 ||
    current > candidates.length ||
    raw === current
  ) {
    return raw;
  }

  if (raw > current) {
    const boundary = midpointOf(
      candidates[current]
    ) + deadBand;

    return position > boundary ? raw : current;
  }

  const boundary = midpointOf(
    candidates[current - 1]
  ) - deadBand;

  return position < boundary ? raw : current;
}

function midpointOf(
  candidate: DropCandidate
): number {
  return candidate.start + (candidate.size / 2);
}
