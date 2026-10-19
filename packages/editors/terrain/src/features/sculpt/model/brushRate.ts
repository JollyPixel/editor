// Import Internal Dependencies
import type { SculptTool } from "./sculptStamp.ts";

// CONSTANTS
export const RAISE_RATE = 1;
export const BLEND_RATE = 8;
export const MAX_FRAME_TIME = 0.05;

export function stampStrength(
  tool: SculptTool,
  strength: number,
  elapsed: number,
  stamps: number
): number {
  const share = Math.min(Math.max(elapsed, 0), MAX_FRAME_TIME) / Math.max(stamps, 1);

  return tool === "raise" ?
    strength * RAISE_RATE * share :
    Math.min(1, strength * BLEND_RATE * share);
}
