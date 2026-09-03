// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import type {
  VoxelBlockHookEvent,
  VoxelLayerHookEvent
} from "../hooks.ts";
import type { VoxelWorldJSON } from "../serialization/types.ts";

export interface VoxelWorldReplaceCommand {
  action: "world-replace";
  data: VoxelWorldJSON;
}

export type VoxelBlockCommand = VoxelBlockHookEvent;

export type VoxelBlockDefinedCommand = Extract<
  VoxelBlockCommand,
  { action: "block-defined"; }
>;

export type VoxelBlockRemovedCommand = Extract<
  VoxelBlockCommand,
  { action: "block-removed"; }
>;

export type VoxelBlockAction = VoxelBlockCommand["action"];

export type VoxelNetworkCommand =
  & (
    | VoxelLayerHookEvent
    | VoxelWorldReplaceCommand
    | VoxelBlockCommand
  )
  & network.NetworkCommandHeader;

export type VoxelServerMessage = network.NetworkServerMessage<
  VoxelNetworkCommand,
  VoxelWorldJSON
>;
