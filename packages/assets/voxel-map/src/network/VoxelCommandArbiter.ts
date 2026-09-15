// Import Third-party Dependencies
import * as network from "@jolly-pixel/network";
import type { VoxelLayerHookEvent } from "@jolly-pixel/voxel.renderer";
import type { Vector3Like } from "three";

// Import Internal Dependencies
import type { VoxelNetworkCommand } from "./types.ts";

type BulkCommand = Extract<
  VoxelNetworkCommand,
  { action: "voxels-set" | "voxels-removed"; }
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

    const keys = command.action === "world-replace" ?
      [] :
      VoxelCommandArbiter.keys(command);

    return this.#tracker.admit(command, keys);
  }

  static keys(
    command: VoxelLayerHookEvent | VoxelNetworkCommand
  ): string[] {
    if (isBulkCommand(command)) {
      return command.metadata.entries.map(
        (entry) => voxelKey(command.layerName, entry.position)
      );
    }

    const key = VoxelCommandArbiter.key(command);

    return key === null ? [] : [key];
  }

  static key(
    command: VoxelLayerHookEvent | VoxelNetworkCommand
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
}

function isBulkCommand<
  TCommand extends VoxelLayerHookEvent | VoxelNetworkCommand
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
  position: Vector3Like
): string {
  const { x, y, z } = position;

  return `${layerName}:${x},${y},${z}`;
}
