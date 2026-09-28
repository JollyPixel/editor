// Import Internal Dependencies
import type { ResolvedTilesetDefinition } from "./types.ts";

// CONSTANTS
export const MISSING_TILESET_ID = "$missing";
export const MISSING_TILESET_DEFINITION: Readonly<ResolvedTilesetDefinition> = Object.freeze({
  id: MISSING_TILESET_ID,
  tileSize: 16,
  cols: 1,
  rows: 1
});
