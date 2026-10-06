// Import Internal Dependencies
import type { ResolvedBlocksetDefinition } from "./types.ts";

// CONSTANTS
export const MISSING_BLOCKSET_ID = "$missing";
export const MISSING_BLOCKSET_DEFINITION: Readonly<ResolvedBlocksetDefinition> = Object.freeze({
  id: MISSING_BLOCKSET_ID,
  tileSize: 16,
  cols: 1,
  rows: 1
});
