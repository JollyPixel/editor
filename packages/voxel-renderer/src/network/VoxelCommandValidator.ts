// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import { VOXEL_BLOCK_HOOK_ACTIONS } from "../hooks.ts";
import type {
  VoxelBlockCommand,
  VoxelNetworkCommand
} from "./types.ts";

// CONSTANTS
const kBlockActions = new Set<string>(VOXEL_BLOCK_HOOK_ACTIONS);

export function isVoxelNetworkCommand(
  value: unknown
): value is VoxelNetworkCommand {
  return typeof value === "object" && value !== null &&
    "action" in value && "clientId" in value;
}

export function isVoxelBlockCommand(
  command: VoxelNetworkCommand
): command is VoxelBlockCommand & network.NetworkCommandHeader {
  return kBlockActions.has(command.action);
}
