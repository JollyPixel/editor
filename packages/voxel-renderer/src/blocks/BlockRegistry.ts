// Import Internal Dependencies
import {
  AIR_BLOCK_ID,
  isAir
} from "./BlockId.ts";
import {
  resolveBlockDefinition,
  type BlockDefinition,
  type ResolvedBlockDefinition
} from "./BlockDefinition.ts";

export interface BlockRegisterManyOptions {
  /**
   * Keeps the registration an id already has instead of replacing it.
   * @default false
   */
  skipExisting?: boolean;
}

export class BlockRegistry implements Iterable<ResolvedBlockDefinition> {
  #blocks = new Map<number, ResolvedBlockDefinition>();
  #version = 0;
  #highestId = 0;

  constructor(
    defs: BlockDefinition[] = []
  ) {
    this.registerMany(defs);
  }

  register(
    def: BlockDefinition
  ): this {
    if (isAir(def.id)) {
      throw new Error(
        `Block id ${AIR_BLOCK_ID} is reserved for air and cannot be registered.`
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

  registerMany(
    defs: Iterable<BlockDefinition>,
    options: BlockRegisterManyOptions = {}
  ): this {
    const { skipExisting = false } = options;

    for (const def of defs) {
      if (skipExisting && this.has(def.id)) {
        continue;
      }

      this.register(def);
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
