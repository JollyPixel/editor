// Import Internal Dependencies
import {
  MaterialGroup,
  type MaterialGroupJSON
} from "./MaterialGroup.ts";

export class MaterialGroupList implements Iterable<MaterialGroup> {
  #groups = new Map<string, MaterialGroup>();
  #version = 0;

  constructor(
    groups: Iterable<unknown> = []
  ) {
    this.replace(groups);
  }

  get version(): number {
    return this.#version;
  }

  get size(): number {
    return this.#groups.size;
  }

  [Symbol.iterator](): IterableIterator<MaterialGroup> {
    return this.#groups.values();
  }

  ids(): Set<string> {
    return new Set(this.#groups.keys());
  }

  has(
    groupId: string
  ): boolean {
    return this.#groups.has(groupId);
  }

  get(
    groupId: string
  ): MaterialGroup | undefined {
    return this.#groups.get(groupId);
  }

  define(
    group: MaterialGroup | MaterialGroupJSON
  ): boolean {
    const next = group instanceof MaterialGroup ?
      group :
      MaterialGroup.parse(group);
    if (next === null || this.#groups.get(next.id)?.equals(next)) {
      return false;
    }

    this.#groups.set(next.id, next);
    this.#version++;

    return true;
  }

  remove(
    groupId: string
  ): boolean {
    if (!this.#groups.delete(groupId)) {
      return false;
    }
    this.#version++;

    return true;
  }

  replace(
    groups: Iterable<unknown>
  ): void {
    this.#groups.clear();
    for (const value of groups) {
      const group = MaterialGroup.parse(value);
      if (group !== null && !this.#groups.has(group.id)) {
        this.#groups.set(group.id, group);
      }
    }
    this.#version++;
  }

  clear(): void {
    this.replace([]);
  }

  toJSON(): MaterialGroupJSON[] {
    return Array.from(this.#groups.values(), (group) => group.toJSON());
  }
}
