// Import Internal Dependencies
import type { Coords, TileRef, TileRefIn } from "../tileset/types.ts";
import type { BlockDefinition, BlockDefinitionIn } from "./BlockDefinition.ts";

/**
 * Registry mapping numeric block IDs to their definitions.
 * Block ID 0 is reserved for air and cannot be registered.
 */
export class BlockRegistry {
  #blocks = new Map<number, BlockDefinition>();

  constructor(
    defs: BlockDefinitionIn[] = []
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
    def: BlockDefinitionIn
  ): this {
    if (def.id === 0) {
      throw new Error("Block ID 0 is reserved for air and cannot be registered.");
    }

    for (const face in def.faceTextures) {
      if (!Object.hasOwn(def.faceTextures, face)) {
        continue;
      }
      const ref: TileRefIn = def.faceTextures[face];
      if (Array.isArray(ref)) {
        def.faceTextures[face] = this.#makeTileRef(ref, def.defaultTilesetId);

        continue;
      }
      if (this.#canAddDefaultTileSetId(ref, def.defaultTilesetId)) {
        ref.tilesetId = def.defaultTilesetId;
      }
    }

    if (def.defaultTexture) {
      if (Array.isArray(def.defaultTexture)) {
        def.defaultTexture = this.#makeTileRef(def.defaultTexture, def.defaultTilesetId);
      }
      else if (this.#canAddDefaultTileSetId(def.defaultTexture, def.defaultTilesetId)) {
        def.defaultTexture.tilesetId = def.defaultTilesetId;
      }
    }

    delete def.defaultTilesetId;

    this.#blocks.set(def.id, def as BlockDefinition);

    return this;
  }

  #canAddDefaultTileSetId(ref: TileRef, defaultTilesetId: string | undefined) {
    return !ref.tilesetId && defaultTilesetId;
  }

  #makeTileRef(coords: Coords, defaultTilesetId: string | undefined): TileRef {
    return {
      col: coords[0],
      row: coords[1],
      tilesetId: defaultTilesetId
    };
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
