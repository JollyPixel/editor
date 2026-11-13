// Import Internal Dependencies
import { TrackPath } from "./TrackPath.ts";

export interface TrackEntry {
  readonly path: string;
}

export class TrackMap<T extends TrackEntry> implements Iterable<T> {
  static #keyed<T extends TrackEntry>(
    entries: ReadonlyMap<string, T>
  ): TrackMap<T> {
    const map = new TrackMap<T>();
    map.#entries = entries;

    return map;
  }

  #entries: ReadonlyMap<string, T>;

  constructor(
    entries: Iterable<T> = []
  ) {
    const keyed = new Map<string, T>();
    for (const entry of entries) {
      keyed.set(uniqueKey(keyed, entry.path), entry);
    }
    this.#entries = keyed;
  }

  get size(): number {
    return this.#entries.size;
  }

  has(
    path: string
  ): boolean {
    return this.#entries.has(new TrackPath(path).key);
  }

  get(
    path: string
  ): T | undefined {
    return this.#entries.get(new TrackPath(path).key);
  }

  * paths(): IterableIterator<string> {
    for (const { path } of this.#entries.values()) {
      yield path;
    }
  }

  [Symbol.iterator](): IterableIterator<T> {
    return this.#entries.values();
  }

  with(
    entry: T
  ): TrackMap<T> {
    return TrackMap.#keyed(
      new Map(this.#entries).set(new TrackPath(entry.path).key, entry)
    );
  }

  without(
    path: string
  ): TrackMap<T> {
    const { key } = new TrackPath(path);
    if (!this.#entries.has(key)) {
      return this;
    }

    const entries = new Map(this.#entries);
    entries.delete(key);

    return TrackMap.#keyed(entries);
  }

  map<U extends TrackEntry>(
    mapper: (entry: T) => U
  ): TrackMap<U> {
    const entries = new Map<string, U>();
    for (const [key, entry] of this.#entries) {
      const mapped = mapper(entry);
      const next = mapped.path === entry.path ? key : new TrackPath(mapped.path).key;
      if (entries.has(next)) {
        throw new RangeError(`Track path ${mapped.path} repeats`);
      }
      entries.set(next, mapped);
    }

    return TrackMap.#keyed(entries);
  }
}

function uniqueKey(
  entries: ReadonlyMap<string, unknown>,
  path: string
): string {
  const { key } = new TrackPath(path);
  if (entries.has(key)) {
    throw new RangeError(`Track path ${path} repeats`);
  }

  return key;
}
