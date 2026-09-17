// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";
import {
  DEFAULT_TILE_SIZE,
  type TilesetList
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { TilesetStore } from "../../app/state/index.ts";
import { resolveTilesetEntries } from "./tilesetEntries.ts";

export interface TilesetCatalog {
  records(): Iterable<AssetRecordData>;
  on(event: "change", listener: () => void): unknown;
  off(event: "change", listener: () => void): unknown;
}

export interface TilesetDirectoryOptions {
  store: TilesetStore;
  tilesets: TilesetList;
  catalog?: TilesetCatalog;
}

export class TilesetDirectory {
  readonly #store: TilesetStore;
  readonly #tilesets: TilesetList;
  readonly #catalog: TilesetCatalog | undefined;

  constructor(
    options: TilesetDirectoryOptions
  ) {
    this.#store = options.store;
    this.#tilesets = options.tilesets;
    this.#catalog = options.catalog;

    this.#catalog?.on("change", this.refresh);
    this.refresh();
  }

  readonly refresh = (): void => {
    this.#store.replace(
      resolveTilesetEntries(this.#tilesets, this.#catalog?.records() ?? []),
      this.#tilesets.defaultTileSize ?? DEFAULT_TILE_SIZE
    );
  };

  dispose(): void {
    this.#catalog?.off("change", this.refresh);
  }
}
