// Import Third-party Dependencies
import {
  AssetSource,
  type AssetRecordData
} from "@jolly-pixel/asset";
import type { CatalogCreateOptions } from "@jolly-pixel/asset-server/catalog/client";
import {
  createTilesetAsset,
  createTilesetDocument,
  tilesetAsset,
  TILESET_EXTENSION
} from "@jolly-pixel/asset.voxel-map/network/client.ts";
import type { VoxelEngine } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { TilesetStore } from "../../state/index.ts";
import type { LinkedTilesets } from "./LinkedTilesets.ts";
import { isTilesetAsset } from "./tilesetEntries.ts";

// CONSTANTS
const kTilesetDirectory = "tilesets/";

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
  "addTileset" | "removeTileset" | "tilesets"
>;

export type TilesetDocuments = Pick<LinkedTilesets, "resizeTiles">;

export interface CreateTilesetOptions {
  name: string;
  tileSize: number;
  cols: number;
  rows: number;
}

export interface LinkTilesetOptions {
  assetId: string;
}

export interface TilesetActionsOptions {
  engine: TilesetEngine;
  catalog: TilesetCatalogWriter;
  store: TilesetStore;
  documents: TilesetDocuments;
  generateId?: () => string;
}

export class TilesetActions {
  readonly #engine: TilesetEngine;
  readonly #catalog: TilesetCatalogWriter;
  readonly #store: TilesetStore;
  readonly #documents: TilesetDocuments;
  readonly #generateId: () => string;

  constructor(
    options: TilesetActionsOptions
  ) {
    this.#engine = options.engine;
    this.#catalog = options.catalog;
    this.#store = options.store;
    this.#documents = options.documents;
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
    const assetId = await createTilesetAsset(
      this.#catalog,
      `${kTilesetDirectory}${options.name.trim()}${TILESET_EXTENSION}`,
      createTilesetDocument({
        tileSize: options.tileSize,
        size: {
          x: options.cols * options.tileSize,
          y: options.rows * options.tileSize
        }
      })
    );

    return this.link({ assetId });
  }

  link(
    options: LinkTilesetOptions
  ): string | null {
    const tilesetId = this.#uniqueTilesetId();
    const added = this.#engine.addTileset({
      id: tilesetId,
      asset: tilesetAsset(options.assetId)
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
    return this.#documents.resizeTiles(tilesetId, tileSize);
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
