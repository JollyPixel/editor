// Import Internal Dependencies
import type { NetworkCommandHeader } from "../types.ts";
import { ConflictTracker } from "./ConflictTracker.ts";

export interface Admission<TCommand> {
  readonly command: TCommand;
  commit(version?: number): void;
}

export type ConflictWrites =
  | { readonly scope?: string; readonly keys: readonly string[]; }
  | { readonly scope?: string; readonly reset: true; };

export interface KeyedCommandArbiterOptions<
  TCommand extends NetworkCommandHeader,
  TState
> {
  accepts(
    state: TState,
    command: TCommand
  ): boolean;
  writes(
    command: TCommand,
    state?: TState
  ): ConflictWrites;
  narrow?(
    command: TCommand,
    keep: readonly number[]
  ): TCommand | null;
}

export class KeyedCommandArbiter<
  TCommand extends NetworkCommandHeader,
  TState
> {
  #rules: KeyedCommandArbiterOptions<TCommand, TState>;
  #trackers = new Map<string, ConflictTracker>();

  constructor(
    rules: KeyedCommandArbiterOptions<TCommand, TState>
  ) {
    this.#rules = rules;
  }

  admit(
    state: TState,
    command: TCommand
  ): Admission<TCommand> | null {
    if (!this.#rules.accepts(state, command)) {
      return null;
    }

    const writes = this.#rules.writes(command, state);
    const tracker = this.#tracker(writes.scope);
    if ("reset" in writes) {
      return {
        command,
        commit: (version) => tracker.reset(command, version)
      };
    }

    const { indices, commit } = tracker.admit(command, writes.keys);
    if (indices.length === writes.keys.length) {
      return {
        command,
        commit
      };
    }

    const narrowed = indices.length === 0 ?
      null :
      this.#rules.narrow?.(command, indices) ?? null;

    return narrowed === null ? null : {
      command: narrowed,
      commit
    };
  }

  restore(
    command: TCommand,
    version: number
  ): void {
    const writes = this.#rules.writes(command);
    const tracker = this.#tracker(writes.scope);
    if ("reset" in writes) {
      tracker.reset(command, version);
    }
    else {
      tracker.record(command, writes.keys, version);
    }
  }

  #tracker(
    scope = ""
  ): ConflictTracker {
    let tracker = this.#trackers.get(scope);
    if (tracker === undefined) {
      tracker = new ConflictTracker();
      this.#trackers.set(scope, tracker);
    }

    return tracker;
  }
}
