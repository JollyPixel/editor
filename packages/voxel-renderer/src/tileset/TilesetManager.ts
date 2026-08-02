// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type {
  TileRef,
  TilesetDefinition,
  TilesetUVRegion
} from "./types.ts";
import {
  defaultPadding,
  padAtlas,
  tileUVRegion
} from "./atlasLayout.ts";
import type { BlockDefinition } from "../blocks/BlockDefinition.ts";

export type {
  TileRef,
  TilesetDefinition,
  TilesetUVRegion
};

export interface TilesetManagerOptions {
  /**
   * Edge-replicated gutter, in texels, added around each tile when repacking.
   * Set to 0 to render atlases unchanged.
   * @default half the tile size, clamped to 2..8
   */
  padding?: number;
}

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

/** TilesetDefinition with cols and rows guaranteed (resolved from image dimensions when omitted). */
export type ResolvedTilesetDefinition = TilesetDefinition & {
  cols: number;
  rows: number;
};

/** What an atlas can be backed by: the loaded image, or a repacked canvas. */
export type TilesetImage = HTMLImageElement | HTMLCanvasElement;
export type TilesetTexture = THREE.Texture<TilesetImage>;

export interface TilesetEntry {
  def: ResolvedTilesetDefinition;
  /** Atlas bound to materials, gutter-padded when `padding > 0`. */
  texture: TilesetTexture;
  /** Atlas as registered by the caller, before padding. */
  sourceTexture: TilesetTexture;
  /** Effective gutter, in texels. 0 when the atlas is rendered as-is. */
  padding: number;
  material: THREE.MeshLambertMaterial | null;
}

/**
 * Manages tileset textures and computes UV regions for each tile.
 *
 * Atlases can be repacked with a `padding`-texel gutter copied from tile
 * borders (see `padAtlas`). This makes MSAA UV overshoot sample the same tile,
 * not its neighbour. With `padding = 0`, UVs match the raw atlas.
 *
 * UV formula (Y-flipped for WebGL origin, half-texel inset after gutter,
 * `cell = tileSize + 2 * padding`):
 *   offsetU = (col * cell + padding) / imgW + 0.5 / imgW
 *   offsetV = 1 - ((row + 1) * cell - padding) / imgH + 0.5 / imgH
 *   scaleU  = (tileSize - 1) / imgW
 *   scaleV  = (tileSize - 1) / imgH
 *
 * A single shared THREE.Texture is kept per tileset, no per-tile cloning.
 * NearestFilter is used to preserve pixel-art crispness.
 */
export class TilesetManager {
  #tilesets = new Map<string, TilesetEntry>();
  #defaultTilesetId: string | null = null;
  #version = 0;
  /** null selects `defaultPadding(tileSize)` per tileset. */
  #padding: number | null;

  constructor(
    options: TilesetManagerOptions = {}
  ) {
    this.#padding = options.padding === undefined ?
      null :
      Math.max(0, Math.trunc(options.padding));
  }

  /**
   * Loads a tileset image and registers it under the given definition ID.
    * `loader` is optional; a new TextureLoader is created when omitted.
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
    * Useful for tests or externally loaded textures.
   */
  registerTexture(
    def: TilesetDefinition,
    texture: THREE.Texture<HTMLImageElement>
  ): void {
    const resolvedDef: ResolvedTilesetDefinition = {
      ...def,
      cols: def.cols ?? Math.floor(texture.image.width / def.tileSize),
      rows: def.rows ?? Math.floor(texture.image.height / def.tileSize)
    };

    const padded = this.#padTiles(resolvedDef, texture.image);
    const renderTexture: TilesetTexture = padded === null ?
      texture :
      new THREE.CanvasTexture(padded);

    renderTexture.magFilter = THREE.NearestFilter;
    renderTexture.minFilter = THREE.NearestFilter;
    renderTexture.colorSpace = THREE.SRGBColorSpace;
    renderTexture.generateMipmaps = false;

    this.#tilesets.set(def.id, {
      def: resolvedDef,
      texture: renderTexture,
      sourceTexture: texture,
      padding: padded === null ? 0 : this.#paddingFor(resolvedDef.tileSize),
      material: null
    });

    if (this.#defaultTilesetId === null) {
      this.#defaultTilesetId = def.id;
    }
    this.#version++;
  }

  /**
    * Replaces a tileset source image (for example, after editor write-back) and
    * re-pads it. The image must keep the registered atlas dimensions.
   *
    * Both textures are updated in place because materials keep a reference to
    * the render texture.
   */
  updateSourceImage(
    image: TilesetImage,
    tilesetId = this.#defaultTilesetId
  ): void {
    const entry = tilesetId === null ? undefined : this.#tilesets.get(tilesetId);
    if (!entry) {
      return;
    }

    entry.sourceTexture.image = image;
    entry.sourceTexture.needsUpdate = true;

    if (entry.texture !== entry.sourceTexture) {
      entry.texture.image = this.#padTiles(entry.def, image) ?? image;
      entry.texture.needsUpdate = true;
    }
  }

  /**
    * Repacked atlas with per-tile gutter, or null when padding is disabled or
    * rasterization is unavailable.
   */
  #padTiles(
    def: ResolvedTilesetDefinition,
    image: TilesetImage
  ): HTMLCanvasElement | null {
    return padAtlas(image, {
      cols: def.cols,
      rows: def.rows,
      tileSize: def.tileSize,
      padding: this.#paddingFor(def.tileSize)
    });
  }

  #paddingFor(
    tileSize: number
  ): number {
    return this.#padding ?? defaultPadding(tileSize);
  }

  /**
    * Incremented when tilesets change, invalidating precomputed UV regions.
    * See `BlockRegistry.version`.
   */
  get version(): number {
    return this.#version;
  }

  /**
   * Computes the atlas UV region for the tile at (col, row) in a given tileset.
    * If `tilesetId` is omitted, the first registered tileset is used.
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

    return tileUVRegion(ref.col, ref.row, {
      cols,
      rows,
      tileSize,
      padding: entry.padding
    });
  }

  /**
    * Returns the shared THREE.Texture bound to materials.
    * When padding is enabled, this is the gutter-padded atlas.
    * Always matches `getTileUV()`.
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
    * Returns the atlas as registered, before padding.
    * Editing tools should read/write this texture, then call
    * `updateSourceImage()`. Its pixel grid is the one
    * `TilesetDefinition.tileSize` describes.
   **/
  getSourceTexture(
    tilesetId?: string
  ): THREE.Texture | undefined {
    const id = tilesetId ?? this.#defaultTilesetId;

    return id ?
      this.#tilesets.get(id)?.sourceTexture :
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

    const { cols, rows } = entry.def;

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
      // Same object when padding is off; dispose() is idempotent otherwise.
      entry.sourceTexture.dispose();
      entry.material?.dispose();
    }
    this.#tilesets.clear();
    this.#defaultTilesetId = null;
    this.#version++;
  }
}
