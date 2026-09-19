// Import Third-party Dependencies
import {
  AssetSource,
  type AssetRecordData
} from "@jolly-pixel/asset";
import type { CatalogCreateOptions } from "@jolly-pixel/asset-server/catalog/client";
import { createPixelArtAsset } from "@jolly-pixel/asset.pixel-art/network/client.ts";
import { tilesetAsset } from "@jolly-pixel/asset.voxel-map/network/client.ts";
import { createPixelArtDocument } from "@jolly-pixel/pixel-draw.renderer";
import type { VoxelEngine } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { TilesetStore } from "../../app/state/index.ts";
import { isTilesetAsset } from "./tilesetEntries.ts";

// CONSTANTS
const kTextureDirectory = "textures/";

export interface TilesetCatalogWriter {
  records(): Iterable<AssetRecordData>;
  record(assetId: string): AssetRecordData | undefined;
  create(
    path: string,
    content: Uint8Array,
    options?: CatalogCreateOptions
  ): Promise<string>;
  rename(assetId: string, to: string): Promise<void>;
}

export type TilesetEngine = Pick<
  VoxelEngine,
  "addTileset" | "removeTileset" | "resizeTileset" | "defaultTileSize" | "tilesets"
>;

export interface CreateTilesetOptions {
  name: string;
  tileSize: number;
  cols: number;
  rows: number;
}

export interface LinkTilesetOptions {
  assetId: string;
  tileSize: number;
}

export interface TilesetActionsOptions {
  engine: TilesetEngine;
  catalog: TilesetCatalogWriter;
  store: TilesetStore;
  generateId?: () => string;
}

export class TilesetActions {
  readonly #engine: TilesetEngine;
  readonly #catalog: TilesetCatalogWriter;
  readonly #store: TilesetStore;
  readonly #generateId: () => string;

  constructor(
    options: TilesetActionsOptions
  ) {
    this.#engine = options.engine;
    this.#catalog = options.catalog;
    this.#store = options.store;
    this.#generateId = options.generateId ?? (() => crypto.randomUUID());
  }

  linkableAssets(): AssetRecordData[] {
    const linked = new Set(
      this.#store.entries.map((entry) => entry.assetId)
    );

    return [...this.#catalog.records()]
      .filter((record) => isTilesetAsset(record) && !linked.has(record.id))
      .sort((left, right) => left.source.localeCompare(right.source));
  }

  async create(
    options: CreateTilesetOptions
  ): Promise<string | null> {
    const document = createPixelArtDocument({
      x: options.cols * options.tileSize,
      y: options.rows * options.tileSize
    });
    const assetId = await createPixelArtAsset(
      this.#catalog,
      `${kTextureDirectory}${options.name.trim()}.pixelart`,
      document
    );

    return this.link({
      assetId,
      tileSize: options.tileSize
    });
  }

  link(
    options: LinkTilesetOptions
  ): string | null {
    const tilesetId = this.#uniqueTilesetId();
    const added = this.#engine.addTileset({
      id: tilesetId,
      asset: tilesetAsset(options.assetId),
      tileSize: options.tileSize
    });

    return added ? tilesetId : null;
  }

  remove(
    tilesetId: string
  ): boolean {
    return this.#engine.removeTileset(tilesetId);
  }

  resize(
    tilesetId: string,
    tileSize: number
  ): boolean {
    return this.#engine.resizeTileset(tilesetId, tileSize);
  }

  updateDefaultTileSize(
    defaultTileSize: number
  ): void {
    this.#engine.defaultTileSize = defaultTileSize;
  }

  async rename(
    tilesetId: string,
    name: string
  ): Promise<void> {
    const assetId = this.#store.entry(tilesetId)?.assetId ?? null;
    const record = assetId === null ? undefined : this.#catalog.record(assetId);
    const trimmed = name.trim();
    if (record === undefined || trimmed.length === 0) {
      return;
    }

    const to = new AssetSource(record.source)
      .withName(trimmed)
      .toString();
    if (to !== record.source) {
      await this.#catalog.rename(record.id, to);
    }
  }

  #uniqueTilesetId(): string {
    const taken = this.#engine.tilesets.ids();
    let tilesetId = this.#generateId();
    while (taken.has(tilesetId)) {
      tilesetId = this.#generateId();
    }

    return tilesetId;
  }
}
