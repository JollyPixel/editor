// Import Internal Dependencies
import type {
  TilesetDefinition,
  TilesetTexture
} from "./types.ts";
import { TilesetAtlas } from "./TilesetAtlas.ts";
import { TilesetList } from "./TilesetList.ts";

export interface TilesetManagerOptions {
  padding?: number;
  tilesets?: TilesetList;
}

export class TilesetManager {
  readonly tilesets: TilesetList;

  #atlases = new Map<string, TilesetAtlas>();
  #version = 0;
  #padding: number | null;

  constructor(
    options: TilesetManagerOptions = {}
  ) {
    this.tilesets = options.tilesets ?? new TilesetList();
    this.#padding = options.padding === undefined ?
      null :
      Math.max(0, Math.trunc(options.padding));
  }

  registerTexture(
    def: TilesetDefinition,
    texture: TilesetTexture
  ): TilesetAtlas {
    this.tilesets.add(def);
    const declared = this.tilesets.get(def.id) ?? def;
    const atlas = new TilesetAtlas(
      {
        ...declared,
        cols: def.cols ?? declared.cols,
        rows: def.rows ?? declared.rows
      },
      texture,
      this.#padding
    );

    this.#atlases.get(def.id)?.dispose();
    this.#atlases.set(def.id, atlas);
    this.#version++;

    return atlas;
  }

  unregisterTexture(
    tilesetId: string
  ): boolean {
    const atlas = this.#atlases.get(tilesetId);
    if (!atlas) {
      return false;
    }

    atlas.dispose();
    this.#atlases.delete(tilesetId);
    this.#version++;

    return true;
  }

  syncAtlases(): string[] {
    const changed: string[] = [];
    for (const [tilesetId, atlas] of this.#atlases) {
      const declared = this.tilesets.get(tilesetId);
      if (declared === undefined) {
        atlas.dispose();
        this.#atlases.delete(tilesetId);
        changed.push(tilesetId);
      }
      else if (declared.tileSize !== atlas.def.tileSize) {
        this.#atlases.set(
          tilesetId,
          new TilesetAtlas(declared, atlas.sourceTexture, this.#padding)
        );
        atlas.dispose({ keepSource: true });
        changed.push(tilesetId);
      }
    }
    if (changed.length > 0) {
      this.#version++;
    }

    return changed;
  }

  has(
    tilesetId?: string
  ): boolean {
    const id = tilesetId ?? this.defaultTilesetId;

    return id !== null && this.#atlases.has(id);
  }

  atlas(
    tilesetId?: string
  ): TilesetAtlas {
    const id = tilesetId ?? this.defaultTilesetId;
    if (id === null) {
      throw new Error("TilesetManager: no tilesets have been loaded.");
    }

    const atlas = this.#atlases.get(id);
    if (!atlas) {
      throw new Error(`TilesetManager: tileset "${id}" is not loaded.`);
    }

    return atlas;
  }

  definitions(): TilesetDefinition[] {
    return this.tilesets.definitions();
  }

  get version(): number {
    return this.#version + this.tilesets.version;
  }

  get defaultTilesetId(): string | null {
    return this.tilesets.defaultTilesetId;
  }

  dispose(): void {
    for (const atlas of this.#atlases.values()) {
      atlas.dispose();
    }
    this.#atlases.clear();
    this.tilesets.clear();
    this.#version++;
  }
}
