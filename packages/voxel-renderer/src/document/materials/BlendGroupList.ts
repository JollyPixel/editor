// Import Internal Dependencies
import {
  BlendGroup,
  type BlendGroupJSON
} from "./BlendGroup.ts";
import type { VoxelBlendGroupCommand } from "../commands/types.ts";

export class BlendGroupList implements Iterable<BlendGroup> {
  #groups = new Map<string, BlendGroup>();
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

  [Symbol.iterator](): IterableIterator<BlendGroup> {
    return this.#groups.values();
  }

  has(
    groupId: string
  ): boolean {
    return this.#groups.has(groupId);
  }

  get(
    groupId: string
  ): BlendGroup | undefined {
    return this.#groups.get(groupId);
  }

  define(
    group: BlendGroup | BlendGroupJSON
  ): boolean {
    const next = group instanceof BlendGroup ?
      group :
      BlendGroup.parse(group);
    if (next === null || this.#groups.get(next.id)?.equals(next)) {
      return false;
    }

    this.#groups.set(next.id, next);
    this.#version++;

    return true;
  }

  applyCommand(
    command: VoxelBlendGroupCommand
  ): VoxelBlendGroupCommand | null {
    if (command.action === "blend-group-removed") {
      return this.remove(command.groupId) ? command : null;
    }

    const group = BlendGroup.parse(command.group);
    if (group === null || !this.define(group)) {
      return null;
    }

    return {
      action: command.action,
      group: group.toJSON()
    };
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
      const group = BlendGroup.parse(value);
      if (group !== null && !this.#groups.has(group.id)) {
        this.#groups.set(group.id, group);
      }
    }
    this.#version++;
  }

  clear(): void {
    this.replace([]);
  }

  toJSON(): BlendGroupJSON[] {
    return Array.from(
      this.#groups.values(),
      (group) => group.toJSON()
    );
  }
}
