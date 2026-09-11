// Import Third-party Dependencies
import * as network from "@jolly-pixel/network";
import type { Vector3Like } from "three";

// Import Internal Dependencies
import type { VoxelLayerHookEvent } from "../hooks.ts";
import type { VoxelNetworkCommand } from "./types.ts";

export interface VoxelCommandArbiterOptions {
  /**
   * Custom conflict resolver.
   * @default network.LastWriteWinsResolver
   */
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

  admit<TCommand extends VoxelNetworkCommand>(
    command: TCommand
  ): TCommand | null {
    /*
     * Narrowing only ever drops entries, never changing the action the
     * caller resolved the command to.
     */
    return this.#admit(command) as TCommand | null;
  }

  record(
    command: VoxelNetworkCommand
  ): void {
    for (const key of VoxelCommandArbiter.keys(command)) {
      this.#tracker.record(key, command);
    }
  }

  static keys(
    command: VoxelLayerHookEvent | VoxelNetworkCommand
  ): string[] {
    if (isBulkCommand(command)) {
      return entryKeys(
        command.layerName,
        command.metadata.entries
      );
    }

    const key = VoxelCommandArbiter.key(command);

    return key === null ? [] : [key];
  }

  static key(
    command: VoxelLayerHookEvent | VoxelNetworkCommand
  ): string | null {
    if (
      command.action === "voxel-set" ||
      command.action === "voxel-removed"
    ) {
      return voxelKey(command.layerName, command.metadata.position);
    }

    if (command.action === "object-added") {
      return `object:${command.metadata.object.id}`;
    }
    if (
      command.action === "object-removed" ||
      command.action === "object-updated" ||
      command.action === "object-moved"
    ) {
      return `object:${command.metadata.objectId}`;
    }

    if (command.action === "block-defined") {
      return `block:${command.block.id}`;
    }
    if (command.action === "block-removed") {
      return `block:${command.blockId}`;
    }

    return null;
  }

  #admit(
    command: VoxelNetworkCommand
  ): VoxelNetworkCommand | null {
    if (!isBulkCommand(command)) {
      return this.#wins(VoxelCommandArbiter.key(command), command) ?
        command :
        null;
    }

    const keep = (
      entry: { position: Vector3Like; }
    ): boolean => this.#wins(
      voxelKey(command.layerName, entry.position),
      command
    );

    if (command.action === "voxels-set") {
      const entries = command.metadata.entries.filter(keep);
      if (entries.length === command.metadata.entries.length) {
        return command;
      }

      return entries.length === 0 ? null : {
        ...command,
        metadata: { entries }
      };
    }

    const entries = command.metadata.entries.filter(keep);
    if (entries.length === command.metadata.entries.length) {
      return command;
    }

    return entries.length === 0 ? null : {
      ...command,
      metadata: { entries }
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

function entryKeys(
  layerName: string,
  entries: readonly { position: Vector3Like; }[]
): string[] {
  return entries.map(
    (entry) => voxelKey(layerName, entry.position)
  );
}

function voxelKey(
  layerName: string,
  position: Vector3Like
): string {
  const { x, y, z } = position;

  return `${layerName}:${x},${y},${z}`;
}
