// Import Internal Dependencies
import {
  InvalidModelTreeError,
  type ModelTreeEntry
} from "./InvalidModelTreeError.ts";

export interface OrderedTreeEntry {
  id: string;
  parentId: string | null;
  name: string;
}

export interface OrderedTreeOptions<T extends OrderedTreeEntry> {
  kind: ModelTreeEntry;
  /** Not asked for the root, which takes anything. */
  canContain: (parent: T) => boolean;
}

export class OrderedTree<T extends OrderedTreeEntry> {
  #entries = new Map<string, T>();
  #kind: ModelTreeEntry;
  #canContain: (parent: T) => boolean;

  constructor(
    options: OrderedTreeOptions<T>
  ) {
    this.#kind = options.kind;
    this.#canContain = options.canContain;
  }

  get size(): number {
    return this.#entries.size;
  }

  has(
    id: string
  ): boolean {
    return this.#entries.has(id);
  }

  get(
    id: string
  ): T | undefined {
    const entry = this.#entries.get(id);

    return entry === undefined ? undefined : structuredClone(entry);
  }

  peek(
    id: string
  ): Readonly<T> | undefined {
    return this.#entries.get(id);
  }

  * values(): IterableIterator<T> {
    for (const entry of this.#entries.values()) {
      yield structuredClone(entry);
    }
  }

  scan(): IterableIterator<Readonly<T>> {
    return this.#entries.values();
  }

  childrenOf(
    parentId: string | null
  ): T[] {
    return [...this.#entries.values()]
      .filter((entry) => entry.parentId === parentId)
      .map((entry) => structuredClone(entry));
  }

  nextSiblingOf(
    id: string
  ): string | undefined {
    const entry = this.#entries.get(id);
    if (entry === undefined) {
      return undefined;
    }

    let passed = false;
    for (const candidate of this.#entries.values()) {
      if (candidate.id === id) {
        passed = true;
      }
      else if (passed && candidate.parentId === entry.parentId) {
        return candidate.id;
      }
    }

    return undefined;
  }

  subtreeOf(
    id: string
  ): T[] {
    return this.#subtreeOf(id).map((entry) => structuredClone(entry));
  }

  canAdd(
    entry: T,
    beforeId: string | undefined
  ): boolean {
    return !this.#entries.has(entry.id) &&
      this.#isParent(entry.parentId) &&
      this.#isSiblingSlot(beforeId, entry.parentId, entry.id);
  }

  canMove(
    id: string,
    parentId: string | null,
    beforeId: string | undefined
  ): boolean {
    return this.#entries.has(id) &&
      this.#isParent(parentId) &&
      !this.#isWithin(parentId, id) &&
      this.#isSiblingSlot(beforeId, parentId, id);
  }

  add(
    entry: T,
    beforeId: string | undefined
  ): void {
    this.#entries.set(entry.id, structuredClone(entry));
    if (beforeId !== undefined) {
      this.#placeBefore(entry.id, beforeId);
    }
  }

  move(
    id: string,
    parentId: string | null,
    beforeId: string | undefined
  ): void {
    this.update(id, (entry) => {
      return {
        ...entry,
        parentId
      };
    });
    this.#placeBefore(id, beforeId ?? null);
  }

  update(
    id: string,
    change: (entry: T) => T
  ): void {
    const entry = this.#entries.get(id);
    if (entry !== undefined) {
      this.#entries.set(id, change(entry));
    }
  }

  remove(
    id: string
  ): void {
    for (const entry of this.#subtreeOf(id)) {
      this.#entries.delete(entry.id);
    }
  }

  liftChildren(
    id: string
  ): void {
    const entry = this.#entries.get(id);
    if (entry === undefined) {
      return;
    }

    for (const child of this.childrenOf(id)) {
      this.move(child.id, entry.parentId, id);
    }
  }

  load(
    entries: Iterable<T>
  ): void {
    const loaded = new Map<string, T>();
    for (const entry of entries) {
      if (loaded.has(entry.id)) {
        throw new InvalidModelTreeError(this.#kind, entry.id, "is listed twice");
      }
      loaded.set(entry.id, structuredClone(entry));
    }
    for (const entry of loaded.values()) {
      this.#assertRooted(loaded, entry);
    }

    this.#entries = loaded;
  }

  clear(): void {
    this.#entries.clear();
  }

  #isParent(
    id: string | null
  ): boolean {
    if (id === null) {
      return true;
    }

    const parent = this.#entries.get(id);

    return parent !== undefined && this.#canContain(parent);
  }

  #isSiblingSlot(
    beforeId: string | undefined,
    parentId: string | null,
    id: string
  ): boolean {
    return beforeId === undefined || (
      beforeId !== id &&
      this.#entries.get(beforeId)?.parentId === parentId
    );
  }

  #isWithin(
    id: string | null,
    ancestorId: string
  ): boolean {
    let current = id;
    for (let step = 0; current !== null && step <= this.#entries.size; step++) {
      if (current === ancestorId) {
        return true;
      }
      current = this.#entries.get(current)?.parentId ?? null;
    }

    return false;
  }

  #placeBefore(
    id: string,
    beforeId: string | null
  ): void {
    const entry = this.#entries.get(id);
    if (entry === undefined) {
      return;
    }

    const placed = new Map<string, T>();
    for (const [key, value] of this.#entries) {
      if (key === beforeId) {
        placed.set(id, entry);
      }
      if (key !== id) {
        placed.set(key, value);
      }
    }
    placed.set(id, entry);
    this.#entries = placed;
  }

  #subtreeOf(
    id: string
  ): T[] {
    const root = this.#entries.get(id);
    if (root === undefined) {
      return [];
    }

    const byParent = Map.groupBy(this.#entries.values(), (entry) => entry.parentId);
    const subtree: T[] = [];
    const visited = new Set<string>();
    const queue = [root];
    for (const entry of queue) {
      if (visited.has(entry.id)) {
        continue;
      }
      visited.add(entry.id);
      subtree.push(entry);
      queue.push(...byParent.get(entry.id) ?? []);
    }

    return subtree;
  }

  #assertRooted(
    entries: ReadonlyMap<string, T>,
    entry: T
  ): void {
    let parentId = entry.parentId;
    for (let step = 0; parentId !== null; step++) {
      if (parentId === entry.id || step >= entries.size) {
        throw new InvalidModelTreeError(this.#kind, entry.id, "is its own ancestor");
      }

      const parent = entries.get(parentId);
      if (parent === undefined) {
        throw new InvalidModelTreeError(this.#kind, entry.id, `has no parent ${parentId}`);
      }
      if (parentId === entry.parentId && !this.#canContain(parent)) {
        throw new InvalidModelTreeError(this.#kind, entry.id, `cannot be inside ${parentId}`);
      }
      parentId = parent.parentId;
    }
  }
}
