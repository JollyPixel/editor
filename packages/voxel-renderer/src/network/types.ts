// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import type { VoxelLayerHookEvent } from "../hooks.ts";
import type { VoxelWorldJSON } from "../serialization/VoxelSerializer.ts";

export type VoxelNetworkCommand = VoxelLayerHookEvent & network.NetworkCommandHeader;

export type VoxelServerMessage = network.NetworkServerMessage<
  VoxelNetworkCommand,
  VoxelWorldJSON
>;
