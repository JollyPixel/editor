export interface TallyEntry<TKey> {
  key: TKey;
  total: number;
  count: number;
}

export class Tally<TKey = string> implements Iterable<TallyEntry<TKey>> {
  #entries = new Map<TKey, TallyEntry<TKey>>();
  #total = 0;

  get total(): number {
    return this.#total;
  }

  add(
    key: TKey,
    value: number
  ): void {
    const entry = this.#entries.get(key);
    if (entry === undefined) {
      this.#entries.set(key, {
        key,
        total: value,
        count: 1
      });
    }
    else {
      entry.total += value;
      entry.count++;
    }
    this.#total += value;
  }

  top(
    count: number
  ): TallyEntry<TKey>[] {
    return [...this.#entries.values()]
      .sort((left, right) => right.total - left.total)
      .slice(0, count);
  }

  [Symbol.iterator](): IterableIterator<TallyEntry<TKey>> {
    return this.#entries.values();
  }
}
