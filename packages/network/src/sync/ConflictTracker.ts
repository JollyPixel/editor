// Import Internal Dependencies
import type { NetworkCommandHeader } from "../sync/types.ts";
import type {
  ConflictRecord,
  ConflictResolver
} from "./ConflictResolver.ts";

export interface Admission<TCommand> {
  readonly command: TCommand;
  commit(version?: number): void;
}

export interface PartialAdmission {
  readonly indices: number[];
  commit(version?: number): void;
}

export class ConflictTracker<
  THeader extends NetworkCommandHeader = NetworkCommandHeader
> {
  #resolver: ConflictResolver<THeader>;
  #lastByKey = new Map<string, ConflictRecord>();
  #floor: ConflictRecord | undefined;

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
      commit: (version) => this.record(command, keys, version)
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
      commit: (version) => this.record(command, accepted, version)
    };
  }

  record(
    command: NetworkCommandHeader,
    keys: readonly string[],
    version?: number
  ): void {
    const header = recordOf(command, version);
    for (const key of keys) {
      this.#lastByKey.set(key, header);
    }
  }

  reset(
    command: NetworkCommandHeader,
    version?: number
  ): void {
    this.#lastByKey.clear();
    this.#floor = recordOf(command, version);
  }

  #accepts(
    key: string,
    incoming: THeader
  ): boolean {
    return this.#resolver.resolve({
      incoming,
      existing: this.#lastByKey.get(key) ?? this.#floor
    }) === "accept";
  }
}

function recordOf(
  command: NetworkCommandHeader,
  version: number | undefined
): ConflictRecord {
  const header = {
    clientId: command.clientId,
    seq: command.seq,
    timestamp: command.timestamp
  };

  return version === undefined ? header : { ...header, version };
}
