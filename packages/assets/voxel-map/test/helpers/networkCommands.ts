// Import Third-party Dependencies
import {
  rankBetween,
  VOXEL_WORLD_VERSION,
  VoxelWorld,
  isVoxelTemplateCommand,
  type VoxelLayerCommand,
  type VoxelTemplateCommand
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { VoxelMapNetworkCommand } from "../../src/network/server.ts";

type AddedCommand = Extract<VoxelLayerCommand, { action: "added"; }>;

let lastRank: string | null = null;

export function makeAddedCommand(
  layerName: string
): AddedCommand {
  lastRank = rankBetween(lastRank, null);

  return {
    action: "added",
    layerId: layerName,
    metadata: {
      name: layerName,
      rank: lastRank,
      options: {}
    }
  };
}

export function templateCommands(): VoxelTemplateCommand[] {
  const world = new VoxelWorld(16);
  world.addLayer("Ground");
  world.patchVoxels("Ground", [0, 0, 0, 1, 0, 1, 0, 0, 2, 1]);
  const commands: VoxelTemplateCommand[] = [];
  world.on("command", (command) => {
    if (isVoxelTemplateCommand(command)) {
      commands.push(command);
    }
  });

  world.templates.createFromLayer("Ground", { name: "Pair", id: "pair" });
  world.templates.update("pair", { name: "Twin", pivot: { x: 0, y: 0, z: 0 } });
  world.templates.remove("pair");

  return commands;
}

export interface VoxelSetCmdOptions {
  clientId?: string;
  seq?: number;
  timestamp?: number;
  x?: number;
  y?: number;
  z?: number;
  blockId?: number;
  layerId?: string;
}

export function voxelSetCmd(
  opts: VoxelSetCmdOptions = {}
): VoxelMapNetworkCommand {
  return {
    action: "voxel-set",
    layerId: opts.layerId ?? "Ground",
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
): VoxelMapNetworkCommand {
  return {
    action: "world-replace",
    data: {
      version: VOXEL_WORLD_VERSION,
      chunkSize: opts.chunkSize ?? 16,
      blocksets: [],
      layers: []
    },
    clientId: opts.clientId ?? "client-A",
    seq: opts.seq ?? 1,
    timestamp: opts.timestamp ?? 1000
  };
}
