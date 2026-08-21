// Import Third-party Dependencies
import * as network from "@jolly-pixel/network";

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

/**
 * Resolves command conflicts without mutating the world.
 * `world-replace` bypasses arbitration.
 */
export class VoxelCommandArbiter {
  #tracker: network.ConflictTracker<VoxelNetworkCommand>;

  constructor(
    options: VoxelCommandArbiterOptions = {}
  ) {
    this.#tracker = new network.ConflictTracker(
      options.conflictResolver ?? new network.LastWriteWinsResolver()
    );
  }

  /**
   * Defers conflict recording until the caller applies the command.
   */
  resolve(
    command: VoxelNetworkCommand
  ): boolean {
    return this.#tracker.resolve(
      VoxelCommandArbiter.key(command),
      command
    ) !== "reject";
  }

  record(
    command: VoxelNetworkCommand
  ): void {
    this.#tracker.record(
      VoxelCommandArbiter.key(command),
      command
    );
  }

  /**
   * Returns `null` for structural operations.
   */
  static key(
    command: VoxelLayerHookEvent | VoxelNetworkCommand
  ): string | null {
    if (
      command.action === "voxel-set" ||
      command.action === "voxel-removed"
    ) {
      const { x, y, z } = command.metadata.position;

      return `${command.layerName}:${x},${y},${z}`;
    }

    return null;
  }
}
