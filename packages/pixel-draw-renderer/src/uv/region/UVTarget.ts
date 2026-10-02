// Import Internal Dependencies
import type { UVSlot } from "../geometry/types.ts";

export interface UVTarget {
  regionId: string;
  slot: UVSlot | null;
}

export function uvTargetKey(
  target: UVTarget
): string {
  return JSON.stringify([
    target.regionId,
    target.slot
  ]);
}
