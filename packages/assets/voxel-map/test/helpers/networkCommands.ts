// Import Third-party Dependencies
import {
  VOXEL_WORLD_VERSION,
  type VoxelLayerCommand
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { VoxelNetworkCommand } from "../../src/network/server.ts";

type AddedCommand = Extract<VoxelLayerCommand, { action: "added"; }>;

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

export interface WorldReplaceCmdOptions {
  chunkSize?: number;
  clientId?: string;
  seq?: number;
  timestamp?: number;
}

export function worldReplaceCmd(
  opts: WorldReplaceCmdOptions = {}
): VoxelNetworkCommand {
  return {
    action: "world-replace",
    data: {
      version: VOXEL_WORLD_VERSION,
      chunkSize: opts.chunkSize ?? 16,
      tilesets: [],
      layers: []
    },
    clientId: opts.clientId ?? "client-A",
    seq: opts.seq ?? 1,
    timestamp: opts.timestamp ?? 1000
  };
}
