// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type {
  TileRef,
  TilesetDefinition
} from "./types.ts";

export type {
  TileRef,
  TilesetDefinition
};

/** Precomputed UV region for a specific tile in the atlas. */
export interface TilesetUVRegion {
  offsetU: number;
  offsetV: number;
  scaleU: number;
  scaleV: number;
}

/** TilesetDefinition with cols and rows guaranteed (resolved from image dimensions when omitted). */
export type ResolvedTilesetDefinition = TilesetDefinition & {
  cols: number;
  rows: number;
};

export interface TilesetEntry {
  def: ResolvedTilesetDefinition;
  texture: THREE.Texture<HTMLImageElement>;
  material: THREE.MeshLambertMaterial | null;
}

/**
 * Manages tileset textures and computes UV regions for each tile.
 *
 * UV formula (Y-flipped for WebGL origin):
 *   offsetU = col * tileW / imgW
 *   offsetV = 1 - (row + 1) * tileH / imgH
 *   scaleU  = tileW / imgW
 *   scaleV  = tileH / imgH
 *
 * A single shared THREE.Texture is kept per tileset — no per-tile cloning.
 * NearestFilter is used to preserve pixel-art crispness.
 */
export class TilesetManager {
  #tilesets = new Map<string, TilesetEntry>();
  #defaultTilesetId: string | null = null;

  /**
   * Loads a tileset image and registers it under the given definition ID.
   * The loader parameter is optional; a new TextureLoader is created if absent.
   */
  async loadTileset(
    def: TilesetDefinition,
    loader?: THREE.TextureLoader
  ): Promise<void> {
    const textureLoader = loader ?? new THREE.TextureLoader();
    const texture = await textureLoader.loadAsync(def.src);

    this.registerTexture(def, texture);
  }

  /**
   * Registers a tileset from an already-loaded THREE.Texture.
   * Useful in tests or when the texture is loaded externally.
   */
  registerTexture(
    def: TilesetDefinition,
    texture: THREE.Texture<HTMLImageElement>
  ): void {
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;

    const resolvedDef: ResolvedTilesetDefinition = {
      ...def,
      cols: def.cols ?? Math.floor(texture.image.width / def.tileSize),
      rows: def.rows ?? Math.floor(texture.image.height / def.tileSize)
    };

    this.#tilesets.set(
      def.id,
      { def: resolvedDef, texture, material: null }
    );

    if (this.#defaultTilesetId === null) {
      this.#defaultTilesetId = def.id;
    }
  }

  /**
   * Computes the atlas UV region for the tile at (col, row) in a given tileset.
   * If tilesetId is omitted, the first registered tileset is used.
   */
  getTileUV(
    ref: TileRef
  ): TilesetUVRegion {
    const id = ref.tilesetId ?? this.#defaultTilesetId;
    if (id === null) {
      throw new Error("TilesetManager: no tilesets have been loaded.");
    }

    const entry = this.#tilesets.get(id);
    if (!entry) {
      throw new Error(`TilesetManager: tileset "${id}" is not loaded.`);
    }

    const { cols, rows, tileSize } = entry.def;
    const imgW = cols * tileSize;
    const imgH = rows * tileSize;

    return {
      offsetU: ref.col * tileSize / imgW,
      offsetV: 1 - ((ref.row + 1) * tileSize / imgH),
      scaleU: tileSize / imgW,
      scaleV: tileSize / imgH
    };
  }

  /**
   * Returns the shared THREE.Texture for a tileset.
   **/
  getTexture(
    tilesetId?: string
  ): THREE.Texture | undefined {
    const id = tilesetId ?? this.#defaultTilesetId;

    return id ?
      this.#tilesets.get(id)?.texture :
      undefined;
  }

  /**
   * Returns (or lazily creates) a MeshLambertMaterial using the tileset texture.
   * The material is cached per-tileset to avoid redundant GPU uploads.
   */
  createMaterial(
    tilesetId?: string
  ): THREE.MeshLambertMaterial {
    const id = tilesetId ?? this.#defaultTilesetId;
    if (id === null) {
      throw new Error("TilesetManager: no tilesets have been loaded.");
    }

    const entry = this.#tilesets.get(id);
    if (!entry) {
      throw new Error(`TilesetManager: tileset "${id}" is not loaded.`);
    }

    if (!entry.material) {
      entry.material = new THREE.MeshLambertMaterial({
        map: entry.texture,
        side: THREE.FrontSide,
        alphaTest: 0.1
      });
    }

    return entry.material;
  }

  getDefinitions(): ResolvedTilesetDefinition[] {
    return [
      ...this.#tilesets.values()
    ].map((tileSetEntry) => tileSetEntry.def);
  }

  get defaultTilesetId(): string | null {
    return this.#defaultTilesetId;
  }

  dispose(): void {
    for (const entry of this.#tilesets.values()) {
      entry.texture.dispose();
      entry.material?.dispose();
    }
    this.#tilesets.clear();
    this.#defaultTilesetId = null;
  }
}
