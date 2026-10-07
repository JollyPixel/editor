export type KeyedReads = ReadonlyMap<string, () => unknown>;

export class KeyedSnapshot {
  static read(
    reads: KeyedReads
  ): KeyedSnapshot {
    return new KeyedSnapshot(new Map(
      [...reads].map(
        ([key, read]) => [key, KeyedSnapshot.#encode(read())]
      )
    ));
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
      if (this.#values.get(key) !== KeyedSnapshot.#encode(read())) {
        return false;
      }
    }

    return true;
  }
}
