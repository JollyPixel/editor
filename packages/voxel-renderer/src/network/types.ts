// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import type { VoxelLayerHookEvent } from "../hooks.ts";
import type { VoxelWorldJSON } from "../serialization/VoxelSerializer.ts";

/**
 * A one-off admin action that replaces the entire world for every connected
 * client (e.g. importing a JSON file). Deliberately not part of
 * `VoxelLayerHookEvent` — it isn't a per-mutation engine hook, so it's kept
 * out of `VOXEL_LAYER_HOOK_ACTIONS` and `VoxelCommandApplier`.
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
