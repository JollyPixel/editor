// CONSTANTS
export const QUARTER_TURN = Math.PI / 2;

const kFullTurn = Math.PI * 2;
const kDeadBand = 0.1;

export function unwrapAngle(
  previous: number,
  next: number
): number {
  return next + (kFullTurn * Math.round((previous - next) / kFullTurn));
}

export function quarterTurnsFor(
  angle: number,
  current: number
): number {
  const offset = angle - (current * QUARTER_TURN);
  if (Math.abs(offset) <= (QUARTER_TURN / 2) + kDeadBand) {
    return current;
  }

  return Math.round(angle / QUARTER_TURN);
}
