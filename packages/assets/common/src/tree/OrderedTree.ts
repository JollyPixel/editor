// Import Internal Dependencies
import { InvalidEntryError } from "./errors/InvalidEntryError.ts";
import {
  findNextId,
  slotIndex
} from "./siblingSlots.ts";

export interface OrderedTreeEntry {
  id: string;
  parentId: string | null;
}

export interface OrderedTreeOptions<T extends OrderedTreeEntry> {
  entry: string;
  canContain?: (parent: Readonly<T>) => boolean;
}

export class OrderedTree<T extends OrderedTreeEntry> {
  #entries = new Map<string, T>();
  #children = new Map<string | null, string[]>();
  #entry: string;
  #canContain: (parent: Readonly<T>) => boolean;

  constructor(
    options: OrderedTreeOptions<T>
  ) {
    this.#entry = options.entry;
    this.#canContain = options.canContain ?? (() => true);
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
    for (const entry of this.scan()) {
      yield structuredClone(entry);
    }
  }

  scan(): IterableIterator<Readonly<T>> {
    return this.#walk(null);
  }

  listChildren(
    parentId: string | null
  ): T[] {
    return this.#childIds(parentId).map((id) => structuredClone(this.#entries.get(id)!));
  }

  findNextSibling(
    id: string
  ): string | undefined {
    const entry = this.#entries.get(id);

    return entry === undefined ?
      undefined :
      findNextId(this.#childIds(entry.parentId), id);
  }

  subtreeFrom(
    id: string
  ): T[] {
    return this.peekSubtree(id).map((entry) => structuredClone(entry));
  }

  peekSubtree(
    id: string
  ): Readonly<T>[] {
    const root = this.#entries.get(id);

    return root === undefined ? [] : [root, ...this.#walk(id)];
  }

  * ancestorIds(
    id: string
  ): IterableIterator<string> {
    let current = this.#entries.get(id)?.parentId ?? null;
    for (let step = 0; current !== null && step < this.#entries.size; step++) {
      yield current;
      current = this.#entries.get(current)?.parentId ?? null;
    }
  }

  isParent(
    id: string | null
  ): boolean {
    if (id === null) {
      return true;
    }

    const parent = this.#entries.get(id);

    return parent !== undefined && this.#canContain(parent);
  }

  isWithin(
    id: string | null,
    ancestorId: string
  ): boolean {
    if (id === null) {
      return false;
    }
    if (id === ancestorId) {
      return true;
    }
    for (const parentId of this.ancestorIds(id)) {
      if (parentId === ancestorId) {
        return true;
      }
    }

    return false;
  }

  isSiblingSlot(
    beforeId: string | undefined,
    parentId: string | null,
    id: string
  ): boolean {
    return beforeId === undefined || (
      beforeId !== id &&
      this.#entries.get(beforeId)?.parentId === parentId
    );
  }

  canAdd(
    entry: T,
    beforeId: string | undefined
  ): boolean {
    return !this.#entries.has(entry.id) &&
      this.isParent(entry.parentId) &&
      this.isSiblingSlot(beforeId, entry.parentId, entry.id);
  }

  canMove(
    id: string,
    parentId: string | null,
    beforeId: string | undefined
  ): boolean {
    return this.#entries.has(id) &&
      this.isParent(parentId) &&
      !this.isWithin(parentId, id) &&
      this.isSiblingSlot(beforeId, parentId, id);
  }

  add(
    entry: T,
    beforeId: string | undefined
  ): void {
    this.#entries.set(entry.id, structuredClone(entry));
    this.#place(entry.id, entry.parentId, beforeId);
  }

  move(
    id: string,
    parentId: string | null,
    beforeId: string | undefined
  ): void {
    const entry = this.#entries.get(id);
    if (entry === undefined) {
      return;
    }

    this.#detach(entry);
    this.#entries.set(id, {
      ...entry,
      parentId
    });
    this.#place(id, parentId, beforeId);
  }

  update(
    id: string,
    change: (entry: T) => T
  ): void {
    const entry = this.#entries.get(id);
    if (entry !== undefined) {
      this.#entries.set(id, {
        ...change(entry),
        id,
        parentId: entry.parentId
      });
    }
  }

  remove(
    id: string
  ): Readonly<T>[] {
    const removed = this.peekSubtree(id);
    const [root] = removed;
    if (root !== undefined) {
      this.#detach(root);
    }
    for (const entry of removed) {
      this.#children.delete(entry.id);
      this.#entries.delete(entry.id);
    }

    return removed;
  }

  liftChildren(
    id: string
  ): void {
    const entry = this.#entries.get(id);
    if (entry === undefined) {
      return;
    }

    for (const childId of [...this.#childIds(id)]) {
      this.move(childId, entry.parentId, id);
    }
  }

  load(
    entries: Iterable<T>
  ): void {
    const loaded = new Map<string, T>();
    for (const entry of entries) {
      if (loaded.has(entry.id)) {
        throw new InvalidEntryError(this.#entry, entry.id, "is listed twice");
      }
      loaded.set(entry.id, structuredClone(entry));
    }
    for (const entry of loaded.values()) {
      this.#assertRooted(loaded, entry);
    }

    this.clear();
    for (const entry of loaded.values()) {
      this.#entries.set(entry.id, entry);
      this.#place(entry.id, entry.parentId, undefined);
    }
  }

  clear(): void {
    this.#entries.clear();
    this.#children.clear();
  }

  * #walk(
    parentId: string | null
  ): IterableIterator<Readonly<T>> {
    for (const id of this.#childIds(parentId)) {
      yield this.#entries.get(id)!;
      yield* this.#walk(id);
    }
  }

  #childIds(
    parentId: string | null
  ): readonly string[] {
    return this.#children.get(parentId) ?? [];
  }

  #place(
    id: string,
    parentId: string | null,
    beforeId: string | undefined
  ): void {
    let siblings = this.#children.get(parentId);
    if (siblings === undefined) {
      siblings = [];
      this.#children.set(parentId, siblings);
    }
    siblings.splice(slotIndex(siblings, beforeId), 0, id);
  }

  #detach(
    entry: Readonly<T>
  ): void {
    const siblings = this.#children.get(entry.parentId) ?? [];
    const index = siblings.indexOf(entry.id);
    if (index !== -1) {
      siblings.splice(index, 1);
    }
  }

  #assertRooted(
    entries: ReadonlyMap<string, T>,
    entry: T
  ): void {
    let parentId = entry.parentId;
    for (let step = 0; parentId !== null; step++) {
      if (parentId === entry.id || step >= entries.size) {
        throw new InvalidEntryError(this.#entry, entry.id, "is its own ancestor");
      }

      const parent = entries.get(parentId);
      if (parent === undefined) {
        throw new InvalidEntryError(this.#entry, entry.id, `has no parent ${parentId}`);
      }
      if (parentId === entry.parentId && !this.#canContain(parent)) {
        throw new InvalidEntryError(this.#entry, entry.id, `cannot be inside ${parentId}`);
      }
      parentId = parent.parentId;
    }
  }
}
