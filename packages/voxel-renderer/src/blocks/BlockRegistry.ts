// Import Internal Dependencies
import type { BlockDefinition } from "./BlockDefinition.ts";

/**
 * Registry mapping numeric block IDs to their definitions.
 * Block ID 0 is reserved for air and cannot be registered.
 */
export class BlockRegistry {
  #blocks = new Map<number, BlockDefinition>();

  constructor(
    defs: BlockDefinition[] = []
  ) {
    for (const def of defs) {
      // Skip air block
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
      throw new Error("Block ID 0 is reserved for air and cannot be registered.");
    }
    this.#blocks.set(def.id, def);

    return this;
  }

  get(
    id: number
  ): BlockDefinition | undefined {
    return this.#blocks.get(id);
  }

  has(
    id: number
  ): boolean {
    return this.#blocks.has(id);
  }

  getAll(): IterableIterator<BlockDefinition> {
    return this.#blocks.values();
  }
}
