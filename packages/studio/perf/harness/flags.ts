// Import Third-party Dependencies
import * as z from "zod";

// Import Internal Dependencies
import { STUDIO_MODES } from "./StudioPage.ts";

// CONSTANTS
export const DEFAULT_SETTLE_MS = 4_000;
export const STORAGE_SCHEMA = z.record(z.string(), z.string());
export const MODE_FLAG = z.enum(STUDIO_MODES);
export const STORAGE_FLAG = z.string()
  .transform((json): unknown => JSON.parse(json))
  .pipe(STORAGE_SCHEMA);

export function splitList(
  value: string
): string[] {
  return value.split(",").filter((item) => item !== "");
}
