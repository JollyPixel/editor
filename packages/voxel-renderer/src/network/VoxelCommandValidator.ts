// Import Internal Dependencies
import type { VoxelNetworkCommand } from "./types.ts";

/**
 * Checks the action and sender. The applier validates action metadata.
 */
export function isVoxelNetworkCommand(
  value: unknown
): value is VoxelNetworkCommand {
  return typeof value === "object" && value !== null &&
    "action" in value && "clientId" in value;
}
