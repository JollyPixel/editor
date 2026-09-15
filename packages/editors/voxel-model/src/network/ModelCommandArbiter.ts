// Import Third-party Dependencies
import * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import type { ModelHookEvent } from "../features/groups/hooks.ts";
import type { ModelNetworkCommand } from "./types.ts";

export interface ModelCommandArbiterOptions {
  /** @default network.LastWriteWinsResolver */
  conflictResolver?: network.ConflictResolver<ModelNetworkCommand>;
}

export class ModelCommandArbiter {
  #tracker: network.ConflictTracker<ModelNetworkCommand>;

  constructor(
    options: ModelCommandArbiterOptions = {}
  ) {
    this.#tracker = new network.ConflictTracker(
      options.conflictResolver ?? new network.LastWriteWinsResolver()
    );
  }

  admit<TCommand extends ModelNetworkCommand>(
    command: TCommand
  ): network.Admission<TCommand> | null {
    const key = ModelCommandArbiter.key(command);

    return this.#tracker.admit(command, key === null ? [] : [key]);
  }

  static key(
    command: ModelHookEvent | ModelNetworkCommand
  ): string | null {
    switch (command.action) {
      case "group-transformed":
      case "group-renamed":
      case "group-reparented":
      case "group-reparented-local":
        return `group:${command.uuid}`;
      default:
        return null;
    }
  }
}
