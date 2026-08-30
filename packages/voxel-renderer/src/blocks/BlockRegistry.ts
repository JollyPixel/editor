// Import Internal Dependencies
import {
  resolveBlockDefinition,
  type BlockDefinition,
  type ResolvedBlockDefinition
} from "./BlockDefinition.ts";

export class BlockRegistry implements Iterable<ResolvedBlockDefinition> {
  #blocks = new Map<number, ResolvedBlockDefinition>();
  #version = 0;
  #highestId = 0;

  constructor(
    defs: BlockDefinition[] = []
  ) {
    for (const def of defs) {
      if (def.id === 0) {
        continue;
      }

      this.register(def);
    }
  }

  register(
    def: BlockDefinition
  ): this {
    if (def.id === 0) {
      throw new Error(
        "Block ID 0 is reserved for air and cannot be registered."
      );
    }

    const resolved = resolveBlockDefinition(def);

    this.#blocks.set(
      resolved.id,
      resolved
    );
    this.#version++;
    if (resolved.id > this.#highestId) {
      this.#highestId = resolved.id;
    }

    return this;
  }

  get nextId(): number {
    return this.#highestId + 1;
  }

  get version(): number {
    return this.#version;
  }

  get(
    id: number
  ): ResolvedBlockDefinition | undefined {
    return this.#blocks.get(id);
  }

  has(
    id: number
  ): boolean {
    return this.#blocks.has(id);
  }

  getAll(): IterableIterator<ResolvedBlockDefinition> {
    return this.#blocks.values();
  }

  [Symbol.iterator](): IterableIterator<ResolvedBlockDefinition> {
    return this.getAll();
  }
}
