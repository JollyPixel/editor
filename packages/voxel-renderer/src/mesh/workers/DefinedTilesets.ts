// Import Internal Dependencies
import { tileUvRegion } from "../../tileset/TilesetAtlas.ts";
import { MISSING_TILESET_DEFINITION } from "../../tileset/missingTileset.ts";
import type { ResolvedTilesetDefinition } from "../../tileset/types.ts";
import type {
  TilesetResolver,
  TilesetUvSource
} from "../variants/types.ts";
import type { MeshTilesetDefinitions } from "./MeshDefinitions.ts";

class DefinedTileset implements TilesetUvSource {
  readonly def: ResolvedTilesetDefinition;

  constructor(
    def: ResolvedTilesetDefinition
  ) {
    this.def = def;
  }

  uvFor(
    ...args: Parameters<TilesetUvSource["uvFor"]>
  ): ReturnType<TilesetUvSource["uvFor"]> {
    return tileUvRegion(this.def, ...args);
  }
}

export class DefinedTilesets implements TilesetResolver {
  readonly version = 0;

  #defaultTilesetId: string | null;
  #declared: Set<string>;
  #loaded = new Map<string, DefinedTileset>();
  #missing = new DefinedTileset(MISSING_TILESET_DEFINITION);

  constructor(
    definitions: MeshTilesetDefinitions
  ) {
    this.#defaultTilesetId = definitions.defaultTilesetId;
    this.#declared = new Set(definitions.declared);
    for (const def of definitions.loaded) {
      this.#loaded.set(def.id, new DefinedTileset(def));
    }
  }

  resolve(
    tilesetId?: string
  ): TilesetUvSource | undefined {
    const id = tilesetId ?? this.#defaultTilesetId;
    if (id !== null && this.#declared.has(id)) {
      return this.#loaded.get(id);
    }

    return this.#missing;
  }
}
