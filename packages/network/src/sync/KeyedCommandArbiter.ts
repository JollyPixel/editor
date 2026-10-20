// Import Internal Dependencies
import type { NetworkCommandHeader } from "./types.ts";
import {
  LastWriteWinsResolver,
  type ConflictResolver
} from "./ConflictResolver.ts";
import {
  ConflictTracker,
  type Admission
} from "./ConflictTracker.ts";

export interface KeyedCommandArbiterOptions<
  TCommand extends NetworkCommandHeader,
  TState
> {
  accepts(
    state: TState,
    command: TCommand
  ): boolean;
  keys(
    command: TCommand
  ): readonly string[];
  /**
   * @default new LastWriteWinsResolver()
   */
  conflictResolver?: ConflictResolver<TCommand>;
}

export class KeyedCommandArbiter<
  TCommand extends NetworkCommandHeader,
  TState
> {
  #tracker: ConflictTracker<TCommand>;
  #accepts: KeyedCommandArbiterOptions<TCommand, TState>["accepts"];
  #keys: KeyedCommandArbiterOptions<TCommand, TState>["keys"];

  constructor(
    options: KeyedCommandArbiterOptions<TCommand, TState>
  ) {
    this.#tracker = new ConflictTracker(
      options.conflictResolver ?? new LastWriteWinsResolver()
    );
    this.#accepts = options.accepts;
    this.#keys = options.keys;
  }

  admit<TAdmitted extends TCommand>(
    state: TState,
    command: TAdmitted
  ): Admission<TAdmitted> | null {
    if (!this.#accepts(state, command)) {
      return null;
    }

    return this.#tracker.admit(command, this.#keys(command));
  }

  restore(
    command: TCommand,
    version: number
  ): void {
    this.#tracker.record(command, this.#keys(command), version);
  }
}
