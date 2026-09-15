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
  /**
   * Custom conflict resolver.
   * @default network.LastWriteWinsResolver
   */
  conflictResolver?: network.ConflictResolver<VoxelNetworkCommand>;
}

export interface VoxelArbitration {
  readonly command: VoxelNetworkCommand;
  commit(): void;
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
  ): VoxelArbitration | null {
    const admitted = isBulkCommand(command) ?
      this.#admitEntries(command) :
      this.#admitWhole(command);
    if (admitted === null) {
      return null;
    }

    return {
      command: admitted,
      commit: () => {
        for (const key of VoxelCommandArbiter.keys(admitted)) {
          this.#tracker.record(key, admitted);
        }
      }
    };
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

  #admitWhole(
    command: VoxelNetworkCommand
  ): VoxelNetworkCommand | null {
    const admitted = command.action === "world-replace" ||
      this.#wins(VoxelCommandArbiter.key(command), command);

    return admitted ? command : null;
  }

  #admitEntries<TCommand extends BulkCommand>(
    command: TCommand
  ): TCommand | null {
    const { entries } = command.metadata;
    const kept = entries.filter(
      (entry) => this.#wins(voxelKey(command.layerName, entry.position), command)
    );
    if (kept.length === entries.length) {
      return command;
    }

    return kept.length === 0 ? null : {
      ...command,
      metadata: {
        entries: kept
      }
    };
  }

  #wins(
    key: string | null,
    command: VoxelNetworkCommand
  ): boolean {
    return this.#tracker.resolve(key, command) !== "reject";
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
