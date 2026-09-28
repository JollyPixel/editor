// Import Third-party Dependencies
import * as network from "@jolly-pixel/network";
import {
  deserializeVoxelWorld,
  parseVoxelTemplate,
  parseVoxelWorld,
  TilesetList,
  VOXEL_PATCH_STRIDE,
  VoxelWorld,
  type VoxelLayerCommand,
  type VoxelWorldCommandTarget,
  type VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { VoxelMapNetworkCommand } from "./types.ts";

// CONSTANTS
const kVoxelWriteActions = new Set<string>([
  "voxel-set",
  "voxel-removed",
  "voxels-set",
  "voxels-removed",
  "voxels-patched"
]);

type BulkCommand = Extract<
  VoxelMapNetworkCommand,
  { action: "voxels-set" | "voxels-removed"; }
>;

type PatchCommand = Extract<
  VoxelMapNetworkCommand,
  { action: "voxels-patched"; }
>;

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
    if (
      kVoxelWriteActions.has(command.action) &&
      "layerName" in command &&
      state.world.getLayer(command.layerName) === undefined
    ) {
      return null;
    }
    if (isBulkCommand(command)) {
      return this.#admitEntries(command);
    }
    if (command.action === "voxels-patched") {
      return this.#admitPatch(command);
    }

    return this.#tracker.admit(command, VoxelCommandArbiter.keys(command));
  }

  static keys(
    command: VoxelLayerCommand | VoxelMapNetworkCommand
  ): string[] {
    if (isBulkCommand(command)) {
      return command.metadata.entries.map(
        (entry) => voxelKey(command.layerName, entry.position)
      );
    }
    if (command.action === "voxels-patched") {
      return patchKeys(command.layerName, command.metadata.cells);
    }

    const key = VoxelCommandArbiter.key(command);

    return key === null ? [] : [key];
  }

  static key(
    command: VoxelLayerCommand | VoxelMapNetworkCommand
  ): string | null {
    switch (command.action) {
      case "voxel-set":
      case "voxel-removed":
        return voxelKey(command.layerName, command.metadata.position);
      case "object-added":
        return `object:${command.metadata.object.id}`;
      case "object-removed":
      case "object-updated":
      case "object-moved":
        return `object:${command.metadata.objectId}`;
      case "template-defined":
        return `template:${command.template.id}`;
      case "template-updated":
      case "template-removed":
        return `template:${command.templateId}`;
      case "tileset-added":
        return `tileset:${command.tileset.id}`;
      case "tileset-removed":
        return `tileset:${command.tilesetId}`;
      default:
        return null;
    }
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
      commit: () => this.#tracker.reset(command)
    };
  }

  #admitEntries<TCommand extends BulkCommand>(
    command: TCommand
  ): network.Admission<TCommand> | null {
    const { entries } = command.metadata;
    const { indices, commit } = this.#tracker.admitEach(
      command,
      VoxelCommandArbiter.keys(command)
    );
    if (indices.length === 0) {
      return null;
    }

    const admitted = indices.length === entries.length ?
      command :
      {
        ...command,
        metadata: {
          entries: indices.map((index) => entries[index])
        }
      };

    return {
      command: admitted,
      commit
    };
  }

  #admitPatch(
    command: PatchCommand
  ): network.Admission<PatchCommand> | null {
    const { cells } = command.metadata;
    if (cells.length % VOXEL_PATCH_STRIDE !== 0) {
      return null;
    }

    const { indices, commit } = this.#tracker.admitEach(
      command,
      patchKeys(command.layerName, cells)
    );
    if (indices.length === 0) {
      return null;
    }

    const admitted = indices.length * VOXEL_PATCH_STRIDE === cells.length ?
      command :
      {
        ...command,
        metadata: {
          cells: indices.flatMap((index) => {
            const offset = index * VOXEL_PATCH_STRIDE;

            return cells.slice(offset, offset + VOXEL_PATCH_STRIDE);
          })
        }
      };

    return {
      command: admitted,
      commit
    };
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

function patchKeys(
  layerName: string,
  cells: readonly number[]
): string[] {
  const keys: string[] = [];
  for (let offset = 0; offset < cells.length; offset += VOXEL_PATCH_STRIDE) {
    keys.push(voxelKey(layerName, {
      x: cells[offset],
      y: cells[offset + 1],
      z: cells[offset + 2]
    }));
  }

  return keys;
}

function isBulkCommand<
  TCommand extends VoxelLayerCommand | VoxelMapNetworkCommand
>(
  command: TCommand
): command is Extract<
  TCommand,
  { action: "voxels-set" | "voxels-removed"; }
> {
  return command.action === "voxels-set" ||
    command.action === "voxels-removed";
}

function voxelKey(
  layerName: string,
  position: { x: number; y: number; z: number; }
): string {
  const { x, y, z } = position;

  return `${layerName}:${x},${y},${z}`;
}
