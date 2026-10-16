// Import Third-party Dependencies
import * as z from "zod";

// Import Internal Dependencies
import { STUDIO_MODES } from "./StudioPage.ts";

// CONSTANTS
export const DEFAULT_SETTLE_MS = 4_000;
export const NETWORK_PRESETS = {
  "fast-4g": {
    latency: 165,
    downloadThroughput: 9_000_000 / 8 * 0.9,
    uploadThroughput: 1_500_000 / 8 * 0.9
  },
  "slow-4g": {
    latency: 562.5,
    downloadThroughput: 1_600_000 / 8 * 0.9,
    uploadThroughput: 750_000 / 8 * 0.9
  }
} as const;
export const NETWORK_FLAG = z.enum(["fast-4g", "slow-4g"])
  .transform((preset): NetworkConditions => NETWORK_PRESETS[preset]);
export const STORAGE_SCHEMA = z.record(z.string(), z.string());
export const MODE_FLAG = z.enum(STUDIO_MODES);
export const STORAGE_FLAG = z.string()
  .transform((json): unknown => JSON.parse(json))
  .pipe(STORAGE_SCHEMA);

export type NetworkConditions = typeof NETWORK_PRESETS[keyof typeof NETWORK_PRESETS];

export function splitList(
  value: string
): string[] {
  return value.split(",").filter((item) => item !== "");
}
