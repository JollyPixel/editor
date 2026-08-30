// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type {
  ResolvedTilesetDefinition,
  TilesetDefinition
} from "./types.ts";
import { TilesetAtlas } from "./TilesetAtlas.ts";

export interface TilesetManagerOptions {
  /**
   * Edge-replicated gutter in texels; 0 disables repacking.
   * @default half the tile size, clamped to 2..8
   */
  padding?: number;
}

export class TilesetManager {
  #atlases = new Map<string, TilesetAtlas>();
  #defaultTilesetId: string | null = null;
  #version = 0;
  #padding: number | null;

  constructor(
    options: TilesetManagerOptions = {}
  ) {
    this.#padding = options.padding === undefined ?
      null :
      Math.max(0, Math.trunc(options.padding));
  }

  registerTexture(
    def: TilesetDefinition,
    texture: THREE.Texture<HTMLImageElement>
  ): TilesetAtlas {
    const atlas = new TilesetAtlas(
      def,
      texture,
      this.#padding
    );

    this.#atlases.set(def.id, atlas);
    this.#defaultTilesetId ??= def.id;
    this.#version++;

    return atlas;
  }

  has(
    tilesetId?: string
  ): boolean {
    const id = tilesetId ?? this.#defaultTilesetId;

    return id !== null && this.#atlases.has(id);
  }

  /**
   * @throws when neither `tilesetId` nor a default tileset is registered.
   */
  atlas(
    tilesetId?: string
  ): TilesetAtlas {
    const id = tilesetId ?? this.#defaultTilesetId;
    if (id === null) {
      throw new Error("TilesetManager: no tilesets have been loaded.");
    }

    const atlas = this.#atlases.get(id);
    if (!atlas) {
      throw new Error(`TilesetManager: tileset "${id}" is not loaded.`);
    }

    return atlas;
  }

  definitions(): ResolvedTilesetDefinition[] {
    return [
      ...this.#atlases.values()
    ].map((atlas) => atlas.def);
  }

  get version(): number {
    return this.#version;
  }

  get defaultTilesetId(): string | null {
    return this.#defaultTilesetId;
  }

  dispose(): void {
    for (const atlas of this.#atlases.values()) {
      atlas.dispose();
    }
    this.#atlases.clear();
    this.#defaultTilesetId = null;
    this.#version++;
  }
}
