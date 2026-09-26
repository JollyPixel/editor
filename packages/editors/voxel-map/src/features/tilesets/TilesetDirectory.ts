// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";
import type { TilesetList } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { MapDocumentSignals } from "../../document/index.ts";
import type { TilesetStore } from "../../state/index.ts";
import { resolveTilesetEntries } from "./tilesetEntries.ts";

export interface TilesetCatalog {
  records(): Iterable<AssetRecordData>;
  on(event: "change", listener: () => void): unknown;
  off(event: "change", listener: () => void): unknown;
}

export interface TilesetDirectoryOptions {
  store: TilesetStore;
  tilesets: TilesetList;
  mapDocument: MapDocumentSignals;
  catalog?: TilesetCatalog;
}

export class TilesetDirectory {
  readonly #store: TilesetStore;
  readonly #tilesets: TilesetList;
  readonly #catalog: TilesetCatalog | undefined;
  readonly #unsubscribe: () => void;

  constructor(
    options: TilesetDirectoryOptions
  ) {
    this.#store = options.store;
    this.#tilesets = options.tilesets;
    this.#catalog = options.catalog;

    this.#catalog?.on("change", this.refresh);
    this.#unsubscribe = options.mapDocument.subscribe(
      "tilesetsChanged",
      this.refresh
    );
    this.refresh();
  }

  readonly refresh = (): void => {
    this.#store.replace(
      resolveTilesetEntries(this.#tilesets, this.#catalog?.records() ?? [])
    );
  };

  dispose(): void {
    this.#unsubscribe();
    this.#catalog?.off("change", this.refresh);
  }
}
