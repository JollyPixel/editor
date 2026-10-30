// Import Third-party Dependencies
import type { TerrainCommandAction } from "@jolly-pixel/asset.terrain/client";
import {
  CapabilityTable,
  type Grants,
  type RoomGrants
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type { BrushTool } from "../state/SculptSettings.ts";

// CONSTANTS
const kToolCapabilities: Readonly<Record<BrushTool, TerrainCapability>> = {
  raise: "heights",
  smooth: "heights",
  flatten: "heights",
  terrace: "heights",
  ramp: "heights",
  paint: "paint",
  holes: "holes",
  chunks: "chunks"
};

export type TerrainCapability =
  | "heights"
  | "paint"
  | "holes"
  | "chunks"
  | "materials"
  | "pointsOfInterest";

export type TerrainAccess = Grants<TerrainCapability>;
export type TerrainGrants = RoomGrants<TerrainCommandAction, TerrainCapability>;
export type TerrainAccessSource = Pick<TerrainGrants, "current">;

export const TERRAIN_CAPABILITIES = new CapabilityTable<TerrainCommandAction, TerrainCapability>({
  "heights-patched": "heights",
  "splat-patched": "paint",
  "holes-patched": "holes",
  "chunk-added": "chunks",
  "chunk-removed": "chunks",
  "tier-changed": "chunks",
  "material-added": "materials",
  "material-updated": "materials",
  "material-removed": "materials",
  "texture-size-changed": "materials",
  "poi-added": "pointsOfInterest",
  "poi-updated": "pointsOfInterest",
  "poi-removed": "pointsOfInterest"
});

export function canUseTool(
  access: TerrainAccess,
  tool: BrushTool
): boolean {
  return access.has(kToolCapabilities[tool]);
}

export function canImportHeights(
  access: TerrainAccess
): boolean {
  return access.has("heights") && access.has("chunks");
}
