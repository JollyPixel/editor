// Import Third-party Dependencies
import * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import type {
  AnimationCommand,
  AnimationNetworkCommand
} from "./types.ts";
import { animationConflictKeys } from "./AnimationCommandKeys.ts";

export interface AnimationCommandArbiterOptions {
  conflictResolver?: network.ConflictResolver<AnimationNetworkCommand>;
}

export interface AnimationArbiterState {
  accepts(command: AnimationCommand): boolean;
}

export class AnimationCommandArbiter {
  #tracker: network.ConflictTracker<AnimationNetworkCommand>;

  constructor(
    options: AnimationCommandArbiterOptions = {}
  ) {
    this.#tracker = new network.ConflictTracker(
      options.conflictResolver ?? new network.LastWriteWinsResolver()
    );
  }

  admit<TCommand extends AnimationNetworkCommand>(
    state: AnimationArbiterState,
    command: TCommand
  ): network.Admission<TCommand> | null {
    if (!state.accepts(command)) {
      return null;
    }

    return this.#tracker.admit(command, animationConflictKeys(command));
  }

  restore(
    command: AnimationNetworkCommand,
    version: number
  ): void {
    this.#tracker.record(command, animationConflictKeys(command), version);
  }
}
