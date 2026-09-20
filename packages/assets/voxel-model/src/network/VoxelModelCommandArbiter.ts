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
    command: TCommand
  ): network.Admission<TCommand> | null {
    const key = VoxelModelCommandArbiter.key(command);

    return this.#tracker.admit(command, key === null ? [] : [key]);
  }

  static key(
    command: VoxelModelCommand | VoxelModelNetworkCommand
  ): string | null {
    switch (command.action) {
      case "group-renamed":
      case "group-reparented":
      case "group-reparented-local":
      case "group-transformed":
        return `group:${command.uuid}`;
      case "folder-renamed":
      case "folder-reparented":
        return `folder:${command.uuid}`;
      case "block-placed":
      case "block-unplaced":
        return `placement:${command.blockUuid}`;
      default:
        return null;
    }
  }
}
