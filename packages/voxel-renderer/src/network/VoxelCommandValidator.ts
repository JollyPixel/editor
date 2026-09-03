// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import type {
  VoxelBlockCommand,
  VoxelNetworkCommand
} from "./types.ts";

export function isVoxelNetworkCommand(
  value: unknown
): value is VoxelNetworkCommand {
  return typeof value === "object" && value !== null &&
    "action" in value && "clientId" in value;
}

export function isVoxelBlockCommand(
  command: VoxelNetworkCommand
): command is VoxelBlockCommand & network.NetworkCommandHeader {
  return command.action === "block-defined" ||
    command.action === "block-removed";
}
