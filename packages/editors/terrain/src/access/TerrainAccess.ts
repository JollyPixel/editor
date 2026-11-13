// Import Third-party Dependencies
import {
  TERRAIN_CAPABILITIES,
  type TerrainCommandAction
} from "@jolly-pixel/asset.terrain/client";
import {
  CapabilityTable,
  type CapabilityName,
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

export type TerrainCapability = CapabilityName<typeof TERRAIN_CAPABILITIES>;

export type TerrainAccess = Grants<TerrainCapability>;
export type TerrainGrants = RoomGrants<TerrainCommandAction, TerrainCapability>;
export type TerrainAccessSource = Pick<TerrainGrants, "current">;

export const TERRAIN_CAPABILITY_TABLE = new CapabilityTable(
  TERRAIN_CAPABILITIES
);

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
