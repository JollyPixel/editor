// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type {
  TileRef,
  TilesetDefinition
} from "./types.ts";
import type { BlockDefinition } from "../blocks/BlockDefinition.ts";

export type {
  TileRef,
  TilesetDefinition
};

export interface TilesetDefaultBlockOptions {
  /**
   * Maximum block ID to generate (inclusive).
   * @default 255.
   **/
  limit?: number;
  /**
   * Function to map block IDs to custom block definitions.
   */
  map?: (blockId: number, col: number, row: number) => Omit<BlockDefinition, "id">;
}

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
 * UV formula (Y-flipped for WebGL origin, half-texel inset to prevent bleeding):
 *   offsetU = col * tileW / imgW + 0.5 / imgW
 *   offsetV = 1 - (row + 1) * tileH / imgH + 0.5 / imgH
 *   scaleU  = (tileW - 1) / imgW
 *   scaleV  = (tileH - 1) / imgH
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

    // Inset by half a texel on each side so UV edge vertices sample the
    // centre of the first/last texel rather than the boundary between tiles.
    // This prevents floating-point interpolation from bleeding into adjacent
    // tiles in the atlas (the "white line between blocks" artifact).
    const halfTexelU = 0.5 / imgW;
    const halfTexelV = 0.5 / imgH;

    return {
      offsetU: ref.col * tileSize / imgW + halfTexelU,
      offsetV: 1 - ((ref.row + 1) * tileSize / imgH) + halfTexelV,
      scaleU: (tileSize - 1) / imgW,
      scaleV: (tileSize - 1) / imgH
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

  getDefinitions(): ResolvedTilesetDefinition[] {
    return [
      ...this.#tilesets.values()
    ].map((tileSetEntry) => tileSetEntry.def);
  }

  getDefaultBlocks(
    tilesetId = this.#defaultTilesetId,
    options: TilesetDefaultBlockOptions = {}
  ): BlockDefinition[] {
    const {
      limit = 255,
      map
    } = options;
    const blocks: BlockDefinition[] = [];

    if (!tilesetId) {
      return blocks;
    }

    const entry = this.#tilesets.get(tilesetId);
    if (!entry) {
      return blocks;
    }

    const { tileSize } = entry.def;
    const imgW = entry.texture.image.width;
    const imgH = entry.texture.image.height;
    const cols = Math.floor(imgW / tileSize);
    const rows = Math.floor(imgH / tileSize);

    let blockId = 1;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (blockId > limit) {
          return blocks;
        }

        blocks.push({
          id: blockId,
          name: `Block ${blockId}`,
          shapeId: "cube",
          collidable: false,
          faceTextures: {},
          defaultTexture: {
            tilesetId,
            col,
            row
          },
          ...map?.(blockId, col, row)
        });
        blockId++;
      }
    }

    return blocks;
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
