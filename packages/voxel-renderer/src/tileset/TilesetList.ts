// Import Internal Dependencies
import type { TilesetDefinition } from "./types.ts";
import { isTileSize } from "./tileSize.ts";
import { MISSING_TILESET_ID } from "./missingTileset.ts";
import {
  isTilesetSlot,
  MAX_TILESET_SLOT
} from "../blocks/BlockId.ts";

export class TilesetList implements Iterable<TilesetDefinition> {
  #definitions = new Map<string, TilesetDefinition>();
  #version = 0;

  constructor(
    definitions: Iterable<TilesetDefinition> = []
  ) {
    this.replace(definitions);
  }

  get version(): number {
    return this.#version;
  }

  get size(): number {
    return this.#definitions.size;
  }

  get defaultTilesetId(): string | null {
    return this.#definitions.keys().next().value ?? null;
  }

  [Symbol.iterator](): IterableIterator<TilesetDefinition> {
    return this.definitions()[Symbol.iterator]();
  }

  definitions(): TilesetDefinition[] {
    return Array.from(this.#definitions.values(), copyDefinition);
  }

  ids(): Set<string> {
    return new Set(this.#definitions.keys());
  }

  has(
    tilesetId: string
  ): boolean {
    return this.#definitions.has(tilesetId);
  }

  get(
    tilesetId: string
  ): TilesetDefinition | undefined {
    const definition = this.#definitions.get(tilesetId);

    return definition && copyDefinition(definition);
  }

  bySlot(
    slot: number
  ): TilesetDefinition | undefined {
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
    for (let slot = 0; slot <= MAX_TILESET_SLOT; slot++) {
      if (!taken.has(slot)) {
        return slot;
      }
    }

    return null;
  }

  add(
    definition: TilesetDefinition
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
    definition: TilesetDefinition
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

  remove(
    tilesetId: string
  ): boolean {
    if (!this.#definitions.delete(tilesetId)) {
      return false;
    }
    this.#version++;

    return true;
  }

  replace(
    definitions: Iterable<TilesetDefinition>
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
    definition: TilesetDefinition,
    reserved: Iterable<number> = []
  ): TilesetDefinition | null {
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
  definition: TilesetDefinition
): boolean {
  const { slot, tileSize } = definition;

  return definition.id.length > 0 &&
    definition.id !== MISSING_TILESET_ID &&
    (slot === undefined || isTilesetSlot(slot)) &&
    (tileSize === undefined ? definition.asset !== undefined : isTileSize(tileSize));
}

function copyDefinition(
  definition: TilesetDefinition
): TilesetDefinition {
  if (definition.asset === undefined) {
    return { ...definition };
  }

  return {
    ...definition,
    asset: { ...definition.asset }
  };
}
