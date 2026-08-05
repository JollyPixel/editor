// Import Internal Dependencies
import type { VoxelLayerHookEvent } from "../../src/hooks.ts";
import type { VoxelNetworkCommand } from "../../src/network/types.ts";

type AddedCommand = Extract<VoxelLayerHookEvent, { action: "added"; }>;

/** An "added" layer hook event with empty options, keyed by layer name. */
export function makeAddedCommand(
  layerName: string
): AddedCommand {
  return {
    action: "added",
    layerName,
    metadata: { options: {} }
  };
}

export interface VoxelSetCmdOptions {
  clientId?: string;
  seq?: number;
  timestamp?: number;
  x?: number;
  y?: number;
  z?: number;
  blockId?: number;
  layerName?: string;
}

/** A full "voxel-set" network command, defaulting to origin/block 1/client-A. */
export function voxelSetCmd(
  opts: VoxelSetCmdOptions = {}
): VoxelNetworkCommand {
  return {
    action: "voxel-set",
    layerName: opts.layerName ?? "Ground",
    metadata: {
      position: { x: opts.x ?? 0, y: opts.y ?? 0, z: opts.z ?? 0 },
      blockId: opts.blockId ?? 1,
      rotation: 0,
      flipX: false,
      flipZ: false,
      flipY: false
    },
    clientId: opts.clientId ?? "client-A",
    seq: opts.seq ?? 1,
    timestamp: opts.timestamp ?? 1000
  };
}
