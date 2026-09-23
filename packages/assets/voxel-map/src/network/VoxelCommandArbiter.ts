// Import Third-party Dependencies
import * as network from "@jolly-pixel/network";
import {
  VOXEL_PATCH_STRIDE,
  type VoxelLayerCommand
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { VoxelNetworkCommand } from "./types.ts";

type BulkCommand = Extract<
  VoxelNetworkCommand,
  { action: "voxels-set" | "voxels-removed"; }
>;

type PatchCommand = Extract<
  VoxelNetworkCommand,
  { action: "voxels-patched"; }
>;

export interface VoxelCommandArbiterOptions {
  conflictResolver?: network.ConflictResolver<VoxelNetworkCommand>;
}

export class VoxelCommandArbiter {
  #tracker: network.ConflictTracker<VoxelNetworkCommand>;

  constructor(
    options: VoxelCommandArbiterOptions = {}
  ) {
    this.#tracker = new network.ConflictTracker(
      options.conflictResolver ?? new network.LastWriteWinsResolver()
    );
  }

  admit(
    command: VoxelNetworkCommand
  ): network.Admission<VoxelNetworkCommand> | null {
    if (isBulkCommand(command)) {
      return this.#admitEntries(command);
    }
    if (command.action === "voxels-patched") {
      return this.#admitPatch(command);
    }

    const keys = command.action === "world-replace" ?
      [] :
      VoxelCommandArbiter.keys(command);

    return this.#tracker.admit(command, keys);
  }

  static keys(
    command: VoxelLayerCommand | VoxelNetworkCommand
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
    command: VoxelLayerCommand | VoxelNetworkCommand
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
      case "block-defined":
        return `block:${command.block.id}`;
      case "block-removed":
      case "block-moved":
        return `block:${command.blockId}`;
      case "tileset-added":
        return `tileset:${command.tileset.id}`;
      case "tileset-removed":
      case "tileset-resized":
        return `tileset:${command.tilesetId}`;
      case "default-tile-size-updated":
        return "default-tile-size";
      default:
        return null;
    }
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
  TCommand extends VoxelLayerCommand | VoxelNetworkCommand
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
