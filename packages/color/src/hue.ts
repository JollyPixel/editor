// CONSTANTS
const kHalfTurn = 180;

export const TURN = 360;

export type HueInterpolation =
  | "shorter"
  | "longer"
  | "increasing"
  | "decreasing";

export function wrapHue(
  hue: number
): number {
  return ((hue % TURN) + TURN) % TURN;
}

export function hueDelta(
  from: number,
  to: number
): number {
  return wrapHue(to - from + kHalfTurn) - kHalfTurn;
}

export function hueArc(
  first: number,
  second: number,
  method: HueInterpolation
): [number, number] {
  const delta = second - first;
  switch (method) {
    case "longer":
      if (delta > 0 && delta < kHalfTurn) {
        return [first + TURN, second];
      }
      if (delta > -kHalfTurn && delta <= 0) {
        return [first, second + TURN];
      }

      return [first, second];
    case "increasing":
      return second < first ? [first, second + TURN] : [first, second];
    case "decreasing":
      return first < second ? [first + TURN, second] : [first, second];
    default:
      if (delta > kHalfTurn) {
        return [first + TURN, second];
      }
      if (delta < -kHalfTurn) {
        return [first, second + TURN];
      }

      return [first, second];
  }
}
