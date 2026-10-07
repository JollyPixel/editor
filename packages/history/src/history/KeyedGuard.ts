// Import Internal Dependencies
import type { HistoryGuard } from "./HistoryRegistration.ts";
import {
  KeyedSnapshot,
  type KeyedReads
} from "./KeyedSnapshot.ts";

export interface KeyedGuardEntry {
  readonly key: string;
  read(): unknown;
}

export class KeyedGuard implements HistoryGuard {
  #reads: KeyedReads;

  constructor(
    entries: Iterable<KeyedGuardEntry>
  ) {
    const reads = new Map<string, () => unknown>();
    for (const { key, read } of entries) {
      reads.set(key, read);
    }
    this.#reads = reads;
  }

  get keys(): IterableIterator<string> {
    return this.#reads.keys();
  }

  touches(
    written: Iterable<string>
  ): boolean {
    for (const key of written) {
      if (this.#reads.has(key)) {
        return true;
      }
    }

    return false;
  }

  capture(): KeyedSnapshot {
    return KeyedSnapshot.read(this.#reads);
  }

  same(
    captured: KeyedSnapshot
  ): boolean {
    return captured.matches(this.#reads);
  }
}
