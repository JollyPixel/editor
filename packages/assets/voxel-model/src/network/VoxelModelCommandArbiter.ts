// Import Third-party Dependencies
import * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import type {
  VoxelModelCommand,
  VoxelModelNetworkCommand
} from "./types.ts";

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
      VoxelModelCommandArbiter.keys(command)
    );
  }

  static keys(
    command: VoxelModelCommand | VoxelModelNetworkCommand
  ): string[] {
    switch (command.action) {
      case "node-added":
      case "node-removed":
        return [];
      case "node-renamed":
        return [`name:${command.id}`];
      case "node-moved":
        return [
          `parent:${command.id}`,
          ...command.transforms.map(({ id }) => `transform:${id}`)
        ];
      case "node-transformed":
        return [`transform:${command.id}`];
      case "node-uv-changed":
        return [`uv:${command.id}`];
    }
  }
}
