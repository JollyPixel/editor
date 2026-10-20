// Import Third-party Dependencies
import * as network from "@jolly-pixel/network";
import {
  assertVoxelPatch,
  deserializeVoxelWorld,
  isVoxelLayerCommand,
  isVoxelObjectLayerCommand,
  parseVoxelTemplate,
  parseVoxelWorld,
  BlocksetList,
  VoxelWorld,
  type VoxelPatch,
  type VoxelWorldCommandTarget,
  type VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { VoxelMapNetworkCommand } from "./types.ts";
import {
  isVoxelCellCommand,
  narrowVoxelCellCommand,
  voxelCellKeys,
  voxelCommandKeys
} from "./VoxelCommandKeys.ts";

export const VOXEL_COMMAND_RULES: network.KeyedCommandArbiterOptions<
  VoxelMapNetworkCommand,
  VoxelWorldCommandTarget
> = {
  accepts: acceptsVoxelCommand,
  writes: (command) => (command.action === "world-replace" ?
    { reset: true } :
    { keys: voxelCommandKeys(command) }),
  narrow: (command, keep) => (isVoxelCellCommand(command) ?
    narrowVoxelCellCommand(command, keep) :
    null)
};

export class VoxelCommandArbiter extends network.KeyedCommandArbiter<
  VoxelMapNetworkCommand,
  VoxelWorldCommandTarget
> {
  constructor() {
    super(VOXEL_COMMAND_RULES);
  }
}

function acceptsVoxelCommand(
  state: VoxelWorldCommandTarget,
  command: VoxelMapNetworkCommand
): boolean {
  if (command.action === "world-replace") {
    return loads(command.data, state.world.chunkSize);
  }
  if (command.action === "template-defined" && !parses(command.template)) {
    return false;
  }
  if (!targetsExist(state, command)) {
    return false;
  }
  if (
    command.action === "voxels-patched" &&
    !isWellFormedPatch(command.metadata)
  ) {
    return false;
  }

  return !isVoxelCellCommand(command) || voxelCellKeys(command).length > 0;
}

function targetsExist(
  state: VoxelWorldCommandTarget,
  command: VoxelMapNetworkCommand
): boolean {
  if (!isVoxelLayerCommand(command) || isVoxelObjectLayerCommand(command)) {
    return true;
  }

  const { world } = state;
  const source = world.getLayerById(command.layerId);
  switch (command.action) {
    case "added":
      return source === undefined;
    case "cloned":
      return source !== undefined &&
        world.getLayerById(command.metadata.cloneId) === undefined;
    case "merged": {
      const target = world.getLayerById(command.metadata.targetLayerId);

      return source !== undefined && target !== undefined && target !== source;
    }
    default:
      return source !== undefined;
  }
}

function loads(
  data: VoxelWorldJSON,
  chunkSize: number
): boolean {
  try {
    deserializeVoxelWorld(
      parseVoxelWorld(data),
      new VoxelWorld(chunkSize),
      { blocksets: new BlocksetList() }
    );

    return true;
  }
  catch {
    return false;
  }
}

function parses(
  template: unknown
): boolean {
  try {
    parseVoxelTemplate(template);

    return true;
  }
  catch {
    return false;
  }
}

function isWellFormedPatch(
  patch: VoxelPatch
): boolean {
  try {
    assertVoxelPatch(patch);

    return true;
  }
  catch {
    return false;
  }
}
