// Import Node.js Dependencies
import path from "node:path";

// Import Third-party Dependencies
import {
  NETWORK_PRESETS,
  type NetworkPreset
} from "@jolly-pixel/cdp";
import * as z from "zod";

// Import Internal Dependencies
import { STUDIO_MODES } from "../studio/StudioPage.ts";

// CONSTANTS
export const DEFAULT_SETTLE_MS = 4_000;
export const NETWORK_FLAG = z.enum(Object.keys(NETWORK_PRESETS) as NetworkPreset[])
  .transform((preset) => NETWORK_PRESETS[preset]);
export const STORAGE_SCHEMA = z.record(z.string(), z.string());
export const MODE_FLAG = z.enum(STUDIO_MODES);
export const STORAGE_FLAG = z.string()
  .transform((json): unknown => JSON.parse(json))
  .pipe(STORAGE_SCHEMA);

export function fileIn(
  dir: string | null,
  name: string
): string | undefined {
  return dir === null ? undefined : path.join(dir, name);
}

export function splitList(
  value: string
): string[] {
  return value.split(",").filter((item) => item !== "");
}
