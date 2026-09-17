// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import type { AssetRecordData } from "@jolly-pixel/asset";
import type { CatalogCreateOptions } from "@jolly-pixel/asset-server/catalog/client";
import {
  isVoxelTilesetCommand,
  VoxelEngine,
  type TilesetDefinition,
  type VoxelTilesetCommand
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { TilesetStore } from "../../../src/app/state/index.ts";
import { TilesetDirectory } from "../../../src/features/tilesets/TilesetDirectory.ts";
import type { TilesetCatalogWriter } from "../../../src/features/tilesets/TilesetActions.ts";

export interface CreatedAsset {
  path: string;
  content: Uint8Array;
  options: CatalogCreateOptions | undefined;
}

export class FakeCatalog extends Emitter<{ change: () => void; }> implements TilesetCatalogWriter {
  readonly created: CreatedAsset[] = [];
  readonly renamed: [string, string][] = [];
  readonly #records = new Map<string, AssetRecordData>();

  constructor(
    records: AssetRecordData[] = []
  ) {
    super();
    for (const record of records) {
      this.#records.set(record.id, record);
    }
  }

  records(): IterableIterator<AssetRecordData> {
    return this.#records.values();
  }

  record(
    assetId: string
  ): AssetRecordData | undefined {
    return this.#records.get(assetId);
  }

  create(
    path: string,
    content: Uint8Array,
    options?: CatalogCreateOptions
  ): Promise<string> {
    const id = `asset-${this.#records.size + 1}`;
    this.created.push({ path, content, options });
    this.#records.set(id, {
      id,
      kind: options?.kind ?? "unknown",
      source: path
    });
    this.emit("change");

    return Promise.resolve(id);
  }

  rename(
    assetId: string,
    to: string
  ): Promise<void> {
    const record = this.#records.get(assetId);
    if (record !== undefined) {
      this.#records.set(assetId, { ...record, source: to });
    }
    this.renamed.push([assetId, to]);
    this.emit("change");

    return Promise.resolve();
  }
}

export function setupTilesets(
  tilesets: TilesetDefinition[],
  records: AssetRecordData[]
) {
  const engine = new VoxelEngine();
  for (const tileset of tilesets) {
    engine.addTileset(tileset);
  }

  const store = new TilesetStore();
  const catalog = new FakeCatalog(records);
  const directory = new TilesetDirectory({
    store,
    tilesets: engine.tilesets,
    catalog
  });
  const events: VoxelTilesetCommand[] = [];
  engine.on("command", (command) => {
    if (isVoxelTilesetCommand(command)) {
      events.push(command);
      directory.refresh();
    }
  });

  return {
    engine,
    store,
    catalog,
    directory,
    events
  };
}
