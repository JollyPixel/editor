// Import Internal Dependencies
import type { VoxelNetworkCommand } from "./types.ts";

export function isVoxelNetworkCommand(
  value: unknown
): value is VoxelNetworkCommand {
  return typeof value === "object" && value !== null &&
    "action" in value && "clientId" in value;
}
