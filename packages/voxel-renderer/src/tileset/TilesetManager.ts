// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type {
  ResolvedTilesetDefinition,
  ResolvedTileRef,
  TilesetDefinition,
  TilesetUVRegion
} from "./types.ts";
import { resolveTilesetDefinition } from "./resolve.ts";
import {
  defaultPadding,
  padAtlas,
  padAtlasRegion,
  tileUVRegion,
  type AtlasRegion
} from "./atlasLayout.ts";
import type { ResolvedBlockDefinition } from "../blocks/BlockDefinition.ts";

export type {
  ResolvedTilesetDefinition,
  ResolvedTileRef,
  TilesetDefinition,
  TilesetUVRegion
};

export interface TilesetManagerOptions {
  /**
   * Edge-replicated gutter in texels; 0 disables repacking.
   * @default half the tile size, clamped to 2..8
   */
  padding?: number;
}

export interface TilesetDefaultBlockOptions {
  /**
   * Maximum block ID to generate (inclusive).
   * @default 255.
   */
  limit?: number;
  /**
   * Function to map block IDs to custom block definitions.
   */
  map?: (
    blockId: number,
    col: number,
    row: number
  ) => Omit<ResolvedBlockDefinition, "id">;
}

/**
 * Image or repacked canvas backing an atlas.
 */
export type TilesetImage = HTMLImageElement | HTMLCanvasElement;
export type TilesetTexture = THREE.Texture<TilesetImage>;

export interface TilesetEntry {
  def: ResolvedTilesetDefinition;
  /**
   * Material atlas, padded when `padding > 0`.
   */
  texture: TilesetTexture;
  /**
   * Original unpadded atlas.
   */
  sourceTexture: TilesetTexture;
  /**
   * Effective gutter in texels.
   */
  padding: number;
  material: THREE.MeshLambertMaterial | null;
}

/**
 * Manages source and padded textures with per-tile UV regions.
 */
export class TilesetManager {
  #tilesets = new Map<string, TilesetEntry>();
  #defaultTilesetId: string | null = null;
  #version = 0;
  /**
   * Null selects `defaultPadding(tileSize)`.
   */
  #padding: number | null;

  constructor(
    options: TilesetManagerOptions = {}
  ) {
    this.#padding = options.padding === undefined ?
      null :
      Math.max(0, Math.trunc(options.padding));
  }

  async loadTileset(
    def: TilesetDefinition,
    loader?: THREE.TextureLoader
  ): Promise<void> {
    const textureLoader = loader ?? new THREE.TextureLoader();
    const texture = await textureLoader.loadAsync(def.src);

    this.registerTexture(
      def,
      texture
    );
  }

  registerTexture(
    def: TilesetDefinition,
    texture: THREE.Texture<HTMLImageElement>
  ): void {
    const resolvedDef = resolveTilesetDefinition(def, texture.image);

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
   * Repads a same-size source without replacing texture references.
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
   * Repads touched source-atlas texels, or falls back to a full repad.
   */
  updateSourceRegion(
    image: TilesetImage,
    bounds: AtlasRegion,
    tilesetId = this.#defaultTilesetId
  ): void {
    const entry = tilesetId === null ? undefined : this.#tilesets.get(tilesetId);
    if (!entry) {
      return;
    }

    entry.sourceTexture.image = image;
    entry.sourceTexture.needsUpdate = true;

    if (entry.texture === entry.sourceTexture) {
      return;
    }

    const padded = entry.texture.image;
    if (typeof HTMLCanvasElement === "undefined" || !(padded instanceof HTMLCanvasElement)) {
      entry.texture.image = this.#padTiles(entry.def, image) ?? image;
      entry.texture.needsUpdate = true;

      return;
    }

    padAtlasRegion(padded, image, {
      cols: entry.def.cols,
      rows: entry.def.rows,
      tileSize: entry.def.tileSize,
      padding: entry.padding
    }, bounds);
    entry.texture.needsUpdate = true;
  }

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
   * Changes with tilesets, invalidating cached UV regions.
   */
  get version(): number {
    return this.#version;
  }

  getTileUV(
    ref: ResolvedTileRef
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

  getTexture(
    tilesetId?: string
  ): THREE.Texture | undefined {
    const id = tilesetId ?? this.#defaultTilesetId;

    return id ?
      this.#tilesets.get(id)?.texture :
      undefined;
  }

  /**
   * Returns the unpadded editable texture and its tile size.
   */
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
  ): ResolvedBlockDefinition[] {
    const {
      limit = 255,
      map
    } = options;
    const blocks: ResolvedBlockDefinition[] = [];

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
      entry.sourceTexture.dispose();
      entry.material?.dispose();
    }
    this.#tilesets.clear();
    this.#defaultTilesetId = null;
    this.#version++;
  }
}
