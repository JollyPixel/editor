// Import Third-party Dependencies
import { mulberry32 } from "@jolly-pixel/bench";

// CONSTANTS
export const BATCH = 256;

export type Rng = () => number;

export function batchOf<T>(
  create: (rng: Rng) => T
): T[] {
  const rng = mulberry32();

  return Array.from({ length: BATCH }, () => create(rng));
}
