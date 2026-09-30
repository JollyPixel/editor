// Import Internal Dependencies
import type { NetworkCommandHeader } from "#src/index.ts";

export type ToyBody =
  | { action: "set"; keys: string[]; values: number[]; }
  | { action: "move"; item: string; toIndex: number; }
  | { action: "add"; id: string; parentId: string | null; }
  | { action: "remove"; id: string; }
  | { action: "reparent"; id: string; parentId: string | null; };

export type ToyCommand = ToyBody & NetworkCommandHeader;

export interface ToySnapshot {
  registers: [string, number][];
  list: string[];
  tree: [string, string | null][];
}

export type ToyInverse = () => void;

export const TOY_LIST_ITEMS = ["a", "b", "c", "d"] as const;

export class ToyDocument {
  registers = new Map<string, number>();
  list: string[] = [...TOY_LIST_ITEMS];
  tree = new Map<string, string | null>();

  accepts(
    command: ToyBody
  ): boolean {
    switch (command.action) {
      case "set":
        return command.keys.length === command.values.length;
      case "move":
        return this.list.includes(command.item) &&
          command.toIndex >= 0 &&
          command.toIndex < this.list.length;
      case "add":
        return !this.tree.has(command.id) &&
          this.#isParent(command.parentId);
      case "remove":
        return this.tree.has(command.id);
      case "reparent":
        return this.tree.has(command.id) &&
          this.#isParent(command.parentId) &&
          !this.#isWithin(command.parentId, command.id);
    }
  }

  apply(
    command: ToyBody
  ): ToyInverse {
    switch (command.action) {
      case "set":
        return this.#set(command.keys, command.values);
      case "move":
        return this.#move(command.item, command.toIndex);
      case "add":
        this.tree.set(command.id, command.parentId);

        return () => this.tree.delete(command.id);
      case "remove":
        return this.#remove(command.id);
      case "reparent": {
        const previous = this.tree.get(command.id) ?? null;
        this.tree.set(command.id, command.parentId);

        return () => this.tree.set(command.id, previous);
      }
    }
  }

  subtreeOf(
    id: string
  ): string[] {
    const subtree = [id];
    for (const current of subtree) {
      for (const [child, parentId] of this.tree) {
        if (parentId === current) {
          subtree.push(child);
        }
      }
    }

    return subtree;
  }

  load(
    snapshot: ToySnapshot
  ): void {
    this.registers = new Map(snapshot.registers);
    this.list = [...snapshot.list];
    this.tree = new Map(snapshot.tree);
  }

  toJSON(): ToySnapshot {
    return {
      registers: [...this.registers].sort(byKey),
      list: [...this.list],
      tree: [...this.tree].sort(byKey)
    };
  }

  #set(
    keys: readonly string[],
    values: readonly number[]
  ): ToyInverse {
    const previous = keys.map((key) => this.registers.get(key));
    keys.forEach((key, index) => this.registers.set(key, values[index]));

    return () => {
      for (let index = keys.length - 1; index >= 0; index--) {
        const value = previous[index];
        if (value === undefined) {
          this.registers.delete(keys[index]);
        }
        else {
          this.registers.set(keys[index], value);
        }
      }
    };
  }

  #move(
    item: string,
    toIndex: number
  ): ToyInverse {
    const previous = [...this.list];
    const list = this.list.filter((current) => current !== item);
    list.splice(toIndex, 0, item);
    this.list = list;

    return () => {
      this.list = previous;
    };
  }

  #remove(
    id: string
  ): ToyInverse {
    const removed = this.subtreeOf(id).map(
      (node) => [node, this.tree.get(node) ?? null] as const
    );
    for (const [node] of removed) {
      this.tree.delete(node);
    }

    return () => {
      for (const [node, parentId] of removed) {
        this.tree.set(node, parentId);
      }
    };
  }

  #isParent(
    id: string | null
  ): boolean {
    return id === null || this.tree.has(id);
  }

  #isWithin(
    id: string | null,
    ancestorId: string
  ): boolean {
    let current = id;
    for (let step = 0; current !== null && step <= this.tree.size; step++) {
      if (current === ancestorId) {
        return true;
      }
      current = this.tree.get(current) ?? null;
    }

    return false;
  }
}

function byKey<T>(
  left: [string, T],
  right: [string, T]
): number {
  return left[0] < right[0] ? -1 : 1;
}
