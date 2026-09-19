// Import Internal Dependencies
import type { TilesetDefinition } from "./types.ts";
import { isTileSize } from "./tileSize.ts";

export class TilesetList implements Iterable<TilesetDefinition> {
  #definitions = new Map<string, TilesetDefinition>();
  #defaultTileSize: number | undefined = undefined;
  #version = 0;

  constructor(
    definitions: Iterable<TilesetDefinition> = [],
    defaultTileSize?: number
  ) {
    this.replace(definitions, defaultTileSize);
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

  get defaultTileSize(): number | undefined {
    return this.#defaultTileSize;
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

  add(
    definition: TilesetDefinition
  ): boolean {
    if (
      !isDeclarable(definition) ||
      this.#definitions.has(definition.id)
    ) {
      return false;
    }

    this.#definitions.set(definition.id, copyDefinition(definition));
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

  resize(
    tilesetId: string,
    tileSize: number
  ): boolean {
    const current = this.#definitions.get(tilesetId);
    if (
      current === undefined ||
      !isTileSize(tileSize) ||
      current.tileSize === tileSize
    ) {
      return false;
    }

    const {
      cols: _cols,
      rows: _rows,
      ...source
    } = current;
    this.#definitions.set(tilesetId, {
      ...source,
      tileSize
    });
    this.#version++;

    return true;
  }

  updateDefaultTileSize(
    tileSize: number
  ): boolean {
    if (!isTileSize(tileSize) || tileSize === this.#defaultTileSize) {
      return false;
    }

    this.#defaultTileSize = tileSize;
    this.#version++;

    return true;
  }

  replace(
    definitions: Iterable<TilesetDefinition>,
    defaultTileSize?: number
  ): void {
    this.#definitions.clear();
    for (const definition of definitions) {
      if (
        isDeclarable(definition) &&
        !this.#definitions.has(definition.id)
      ) {
        this.#definitions.set(definition.id, copyDefinition(definition));
      }
    }
    this.#defaultTileSize = isTileSize(defaultTileSize) ?
      defaultTileSize :
      undefined;
    this.#version++;
  }

  clear(): void {
    this.replace([]);
  }
}

function isDeclarable(
  definition: TilesetDefinition
): boolean {
  return definition.id.length > 0 && isTileSize(definition.tileSize);
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
