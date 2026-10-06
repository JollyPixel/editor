// Import Internal Dependencies
import type { BlocksetDefinition } from "./types.ts";
import { isTileSize } from "./tileSize.ts";
import { MISSING_BLOCKSET_ID } from "./missingBlockset.ts";
import {
  isBlocksetSlot,
  MAX_BLOCKSET_SLOT
} from "../blocks/BlockId.ts";
import type { VoxelBlocksetCommand } from "../commands/types.ts";

export class BlocksetList implements Iterable<BlocksetDefinition> {
  #definitions = new Map<string, BlocksetDefinition>();
  #version = 0;

  constructor(
    definitions: Iterable<BlocksetDefinition> = []
  ) {
    this.replace(definitions);
  }

  get version(): number {
    return this.#version;
  }

  get size(): number {
    return this.#definitions.size;
  }

  get defaultBlocksetId(): string | null {
    return this.#definitions.keys().next().value ?? null;
  }

  [Symbol.iterator](): IterableIterator<BlocksetDefinition> {
    return this.definitions()[Symbol.iterator]();
  }

  definitions(): BlocksetDefinition[] {
    return Array.from(this.#definitions.values(), copyDefinition);
  }

  ids(): Set<string> {
    return new Set(this.#definitions.keys());
  }

  has(
    blocksetId: string
  ): boolean {
    return this.#definitions.has(blocksetId);
  }

  get(
    blocksetId: string
  ): BlocksetDefinition | undefined {
    const definition = this.#definitions.get(blocksetId);

    return definition && copyDefinition(definition);
  }

  bySlot(
    slot: number
  ): BlocksetDefinition | undefined {
    for (const definition of this.#definitions.values()) {
      if (definition.slot === slot) {
        return copyDefinition(definition);
      }
    }

    return undefined;
  }

  freeSlot(
    reserved: Iterable<number> = []
  ): number | null {
    const taken = new Set<number>(reserved);
    for (const definition of this.#definitions.values()) {
      if (definition.slot !== undefined) {
        taken.add(definition.slot);
      }
    }
    for (let slot = 0; slot <= MAX_BLOCKSET_SLOT; slot++) {
      if (!taken.has(slot)) {
        return slot;
      }
    }

    return null;
  }

  add(
    definition: BlocksetDefinition
  ): boolean {
    if (
      !isDeclarable(definition) ||
      this.#definitions.has(definition.id)
    ) {
      return false;
    }

    const slotted = this.#withSlot(definition);
    if (slotted === null) {
      return false;
    }

    this.#definitions.set(definition.id, slotted);
    this.#version++;

    return true;
  }

  declare(
    definition: BlocksetDefinition
  ): boolean {
    const current = this.#definitions.get(definition.id);
    if (current === undefined) {
      return this.add(definition);
    }
    if (!isDeclarable(definition)) {
      return false;
    }

    this.#definitions.set(definition.id, copyDefinition({
      ...definition,
      slot: current.slot
    }));
    this.#version++;

    return true;
  }

  apply(
    command: VoxelBlocksetCommand,
    slotsInUse: () => Iterable<number> = () => []
  ): VoxelBlocksetCommand | null {
    switch (command.action) {
      case "blockset-added": {
        const slot = command.blockset.slot ?? this.freeSlot(slotsInUse());
        const added = slot !== null && this.add({ ...command.blockset, slot });
        const blockset = added ? this.get(command.blockset.id) : undefined;

        return blockset === undefined ? null : {
          action: "blockset-added",
          blockset
        };
      }
      case "blockset-removed":
        return this.remove(command.blocksetId) ? command : null;
      default: {
        const unhandled: never = command;
        throw new Error(
          `BlocksetList: unhandled action '${(unhandled as VoxelBlocksetCommand).action}'.`
        );
      }
    }
  }

  remove(
    blocksetId: string
  ): boolean {
    if (!this.#definitions.delete(blocksetId)) {
      return false;
    }
    this.#version++;

    return true;
  }

  replace(
    definitions: Iterable<BlocksetDefinition>
  ): void {
    this.#definitions.clear();
    const candidates = Array.from(definitions).filter(isDeclarable);
    const claimed = candidates.flatMap(
      ({ slot }) => (slot === undefined ? [] : [slot])
    );
    for (const definition of candidates) {
      if (this.#definitions.has(definition.id)) {
        continue;
      }

      const slotted = this.#withSlot(definition, claimed);
      if (slotted !== null) {
        this.#definitions.set(definition.id, slotted);
      }
    }
    this.#version++;
  }

  clear(): void {
    this.replace([]);
  }

  #withSlot(
    definition: BlocksetDefinition,
    reserved: Iterable<number> = []
  ): BlocksetDefinition | null {
    const slot = definition.slot ?? this.freeSlot(reserved);
    if (slot === null || this.bySlot(slot) !== undefined) {
      return null;
    }

    return copyDefinition({
      ...definition,
      slot
    });
  }
}

function isDeclarable(
  definition: BlocksetDefinition
): boolean {
  const { slot, tileSize } = definition;

  return definition.id.length > 0 &&
    definition.id !== MISSING_BLOCKSET_ID &&
    (slot === undefined || isBlocksetSlot(slot)) &&
    (tileSize === undefined ? definition.asset !== undefined : isTileSize(tileSize));
}

function copyDefinition(
  definition: BlocksetDefinition
): BlocksetDefinition {
  if (definition.asset === undefined) {
    return { ...definition };
  }

  return {
    ...definition,
    asset: { ...definition.asset }
  };
}
