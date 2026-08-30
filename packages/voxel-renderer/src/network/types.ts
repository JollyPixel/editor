// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import type { VoxelLayerHookEvent } from "../hooks.ts";
import type { VoxelWorldJSON } from "../serialization/types.ts";

/**
 * Admin command kept outside the per-mutation engine hooks.
 */
export interface VoxelWorldReplaceCommand {
  action: "world-replace";
  data: VoxelWorldJSON;
}

export type VoxelNetworkCommand =
  (VoxelLayerHookEvent | VoxelWorldReplaceCommand) & network.NetworkCommandHeader;

export type VoxelServerMessage = network.NetworkServerMessage<
  VoxelNetworkCommand,
  VoxelWorldJSON
>;
