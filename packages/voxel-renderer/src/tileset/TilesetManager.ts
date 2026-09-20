// Import Internal Dependencies
import type { TilesetTexture } from "./types.ts";
import { TilesetAtlas } from "./TilesetAtlas.ts";
import { TilesetList } from "./TilesetList.ts";
import {
  createMissingTilesetAtlas,
  type MissingTilesetAtlas
} from "./missingTileset.ts";

export interface TilesetManagerOptions {
  tilesets?: TilesetList;
}

export class TilesetManager {
  readonly tilesets: TilesetList;

  #atlases = new Map<string, TilesetAtlas>();
  #missing: MissingTilesetAtlas | null = null;
  #version = 0;

  constructor(
    options: TilesetManagerOptions = {}
  ) {
    this.tilesets = options.tilesets ?? new TilesetList();
  }

  get version(): number {
    return this.#version + this.tilesets.version;
  }

  get defaultTilesetId(): string | null {
    return this.tilesets.defaultTilesetId;
  }

  registerTexture(
    tilesetId: string,
    texture: TilesetTexture
  ): TilesetAtlas {
    const declared = this.tilesets.get(tilesetId);
    if (declared === undefined) {
      throw new Error(
        `TilesetManager: tileset "${tilesetId}" is not declared.`
      );
    }

    const previous = this.#atlases.get(tilesetId);
    if (previous !== undefined && previous.texture !== texture) {
      previous.texture.dispose();
    }

    const atlas = new TilesetAtlas(declared, texture);
    this.#atlases.set(tilesetId, atlas);
    this.#version++;

    return atlas;
  }

  syncAtlases(): string[] {
    const changed: string[] = [];
    for (const [tilesetId, atlas] of this.#atlases) {
      const declared = this.tilesets.get(tilesetId);
      if (declared === undefined) {
        atlas.texture.dispose();
        this.#atlases.delete(tilesetId);
        changed.push(tilesetId);
      }
      else if (declared.tileSize !== atlas.def.tileSize) {
        this.#atlases.set(
          tilesetId,
          new TilesetAtlas(declared, atlas.texture)
        );
        changed.push(tilesetId);
      }
    }
    if (changed.length > 0) {
      this.#version++;
    }

    return changed;
  }

  get(
    tilesetId?: string
  ): TilesetAtlas | undefined {
    const id = tilesetId ?? this.defaultTilesetId;

    return id === null ? undefined : this.#atlases.get(id);
  }

  resolve(
    tilesetId?: string
  ): TilesetAtlas | MissingTilesetAtlas | undefined {
    const id = tilesetId ?? this.defaultTilesetId;
    if (id !== null && this.tilesets.has(id)) {
      return this.#atlases.get(id);
    }

    this.#missing ??= createMissingTilesetAtlas();

    return this.#missing;
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

  dispose(): void {
    for (const atlas of this.#atlases.values()) {
      atlas.texture.dispose();
    }
    this.#atlases.clear();
    this.#missing?.texture.dispose();
    this.#missing = null;
    this.tilesets.clear();
    this.#version++;
  }
}
