// Import Third-party Dependencies
import * as network from "@jolly-pixel/network";
import {
  deserializeVoxelWorld,
  isVoxelLayerCommand,
  isVoxelObjectLayerCommand,
  parseVoxelTemplate,
  parseVoxelWorld,
  TilesetList,
  VOXEL_PATCH_STRIDE,
  VoxelWorld,
  type VoxelWorldCommandTarget,
  type VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { VoxelMapNetworkCommand } from "./types.ts";
import {
  isVoxelCellCommand,
  narrowVoxelCellCommand,
  voxelCellKeys,
  voxelCommandKeys,
  type VoxelCellCommand
} from "./VoxelCommandKeys.ts";

type WorldReplaceCommand = Extract<
  VoxelMapNetworkCommand,
  { action: "world-replace"; }
>;

type TemplateDefinedCommand = Extract<
  VoxelMapNetworkCommand,
  { action: "template-defined"; }
>;

export interface VoxelCommandArbiterOptions {
  conflictResolver?: network.ConflictResolver<VoxelMapNetworkCommand>;
}

export class VoxelCommandArbiter {
  #tracker: network.ConflictTracker<VoxelMapNetworkCommand>;

  constructor(
    options: VoxelCommandArbiterOptions = {}
  ) {
    this.#tracker = new network.ConflictTracker(
      options.conflictResolver ?? new network.LastWriteWinsResolver()
    );
  }

  admit(
    state: VoxelWorldCommandTarget,
    command: VoxelMapNetworkCommand
  ): network.Admission<VoxelMapNetworkCommand> | null {
    if (command.action === "world-replace") {
      return this.#admitWorldReplace(state, command);
    }
    if (command.action === "template-defined" && !parses(command)) {
      return null;
    }
    if (!targetsExist(state, command)) {
      return null;
    }
    if (
      command.action === "voxels-patched" &&
      command.metadata.cells.length % VOXEL_PATCH_STRIDE !== 0
    ) {
      return null;
    }
    if (isVoxelCellCommand(command)) {
      return this.#admitCells(command);
    }

    return this.#tracker.admit(command, voxelCommandKeys(command));
  }

  #admitWorldReplace(
    state: VoxelWorldCommandTarget,
    command: WorldReplaceCommand
  ): network.Admission<VoxelMapNetworkCommand> | null {
    if (!loads(command.data, state.world.chunkSize)) {
      return null;
    }

    return {
      command,
      commit: (version) => this.#tracker.reset(command, version)
    };
  }

  restore(
    command: VoxelMapNetworkCommand,
    version: number
  ): void {
    if (command.action === "world-replace") {
      this.#tracker.reset(command, version);
    }
    else {
      this.#tracker.record(command, voxelCommandKeys(command), version);
    }
  }

  #admitCells<TCommand extends VoxelCellCommand & VoxelMapNetworkCommand>(
    command: TCommand
  ): network.Admission<TCommand> | null {
    const keys = voxelCellKeys(command);
    const { indices, commit } = this.#tracker.admitEach(command, keys);
    if (indices.length === 0) {
      return null;
    }

    return {
      command: indices.length === keys.length ?
        command :
        narrowVoxelCellCommand(command, indices)!,
      commit
    };
  }
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
      { tilesets: new TilesetList() }
    );

    return true;
  }
  catch {
    return false;
  }
}

function parses(
  command: TemplateDefinedCommand
): boolean {
  try {
    parseVoxelTemplate(command.template);

    return true;
  }
  catch {
    return false;
  }
}
