// Import Internal Dependencies
import type { NetworkCommandHeader } from "../sync/types.ts";
import type { ConflictResolver } from "./ConflictResolver.ts";

export interface Admission<TCommand> {
  readonly command: TCommand;
  commit(): void;
}

export interface PartialAdmission {
  readonly indices: number[];
  commit(): void;
}

export class ConflictTracker<
  THeader extends NetworkCommandHeader = NetworkCommandHeader
> {
  #resolver: ConflictResolver<THeader>;
  #lastByKey = new Map<string, THeader>();

  constructor(
    resolver: ConflictResolver<THeader>
  ) {
    this.#resolver = resolver;
  }

  admit<TCommand extends THeader>(
    command: TCommand,
    keys: readonly string[]
  ): Admission<TCommand> | null {
    if (keys.some((key) => !this.#accepts(key, command))) {
      return null;
    }

    return {
      command,
      commit: () => this.#record(keys, command)
    };
  }

  admitEach(
    command: THeader,
    keys: readonly string[]
  ): PartialAdmission {
    const indices: number[] = [];
    const accepted: string[] = [];
    keys.forEach((key, index) => {
      if (this.#accepts(key, command)) {
        indices.push(index);
        accepted.push(key);
      }
    });

    return {
      indices,
      commit: () => this.#record(accepted, command)
    };
  }

  #accepts(
    key: string,
    incoming: THeader
  ): boolean {
    return this.#resolver.resolve({
      incoming,
      existing: this.#lastByKey.get(key)
    }) === "accept";
  }

  #record(
    keys: readonly string[],
    command: THeader
  ): void {
    for (const key of keys) {
      this.#lastByKey.set(key, command);
    }
  }
}
