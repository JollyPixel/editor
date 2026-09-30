// Import Third-party Dependencies
import * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import type {
  VoxelModelCommand,
  VoxelModelNetworkCommand
} from "./types.ts";
import { voxelModelConflictKeys } from "./VoxelModelCommandKeys.ts";

export interface VoxelModelCommandArbiterOptions {
  conflictResolver?: network.ConflictResolver<VoxelModelNetworkCommand>;
}

export interface VoxelModelArbiterState {
  accepts(command: VoxelModelCommand): boolean;
}

export class VoxelModelCommandArbiter {
  #tracker: network.ConflictTracker<VoxelModelNetworkCommand>;

  constructor(
    options: VoxelModelCommandArbiterOptions = {}
  ) {
    this.#tracker = new network.ConflictTracker(
      options.conflictResolver ?? new network.LastWriteWinsResolver()
    );
  }

  admit<TCommand extends VoxelModelNetworkCommand>(
    state: VoxelModelArbiterState,
    command: TCommand
  ): network.Admission<TCommand> | null {
    if (!state.accepts(command)) {
      return null;
    }

    return this.#tracker.admit(
      command,
      voxelModelConflictKeys(command)
    );
  }

  restore(
    command: VoxelModelNetworkCommand,
    version: number
  ): void {
    this.#tracker.record(command, voxelModelConflictKeys(command), version);
  }
}
