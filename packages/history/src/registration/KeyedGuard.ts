// Import Internal Dependencies
import type { HistoryGuard } from "./HistoryRegistration.ts";

export interface KeyedGuardEntry {
  readonly key: string;
  read(): unknown;
}

type KeyedReads = ReadonlyMap<string, () => unknown>;

export class KeyedCapture {
  static read(
    reads: KeyedReads
  ): KeyedCapture {
    const values = new Map(
      [...reads].map(
        ([key, read]) => [key, KeyedCapture.#encode(read())]
      )
    );

    return new KeyedCapture(values);
  }

  static #encode(
    value: unknown
  ): string | undefined {
    return value === undefined
      ? undefined
      : JSON.stringify(value);
  }

  #values: ReadonlyMap<string, string | undefined>;

  constructor(
    values: ReadonlyMap<string, string | undefined>
  ) {
    this.#values = values;
  }

  matches(
    reads: KeyedReads
  ): boolean {
    for (const [key, read] of reads) {
      if (this.#values.get(key) !== KeyedCapture.#encode(read())) {
        return false;
      }
    }

    return true;
  }
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

  capture(): KeyedCapture {
    return KeyedCapture.read(this.#reads);
  }

  same(
    captured: KeyedCapture
  ): boolean {
    return captured.matches(this.#reads);
  }
}
