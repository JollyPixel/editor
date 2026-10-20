// Import Internal Dependencies
import type { NetworkCommandHeader } from "../types.ts";
import {
  supersedes,
  type ConflictRecord
} from "../supersedes.ts";

export interface KeyAdmission {
  readonly indices: number[];
  commit(version?: number): void;
}

export class ConflictTracker {
  #lastByKey = new Map<string, ConflictRecord>();
  #floor: ConflictRecord | undefined;

  admit(
    command: NetworkCommandHeader,
    keys: readonly string[]
  ): KeyAdmission {
    const indices: number[] = [];
    const accepted: string[] = [];
    keys.forEach((key, index) => {
      if (supersedes(command, this.#lastByKey.get(key) ?? this.#floor)) {
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
    const header = toRecord(command, version);
    for (const key of keys) {
      this.#lastByKey.set(key, header);
    }
  }

  reset(
    command: NetworkCommandHeader,
    version?: number
  ): void {
    this.#lastByKey.clear();
    this.#floor = toRecord(command, version);
  }
}

function toRecord(
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
