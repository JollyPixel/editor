// Import Third-party Dependencies
import {
  SchemaParser,
  type Infer
} from "@jolly-pixel/network";
import {
  writeJsonFile,
  type AssetSource
} from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import {
  indexedAssetSchema,
  assetIndexSchema
} from "./AssetIndex.schema.ts";
import {
  silentLogger,
  type Logger
} from "../common/logger.ts";
import { ASSET_INDEX_PATH } from "./stateDirectory.ts";
import {
  keepValid,
  readStateFile,
  type StateFileParse
} from "./stateFile.ts";

// CONSTANTS
const kIndexVersion = 1;
const kPathCollator = new Intl.Collator();
const kEntryParser = new SchemaParser(indexedAssetSchema);
const kIndexParser = new SchemaParser(assetIndexSchema);

export type IndexedAsset = Readonly<Infer<typeof indexedAssetSchema>>;

export interface AssetIndexData {
  readonly version: 1;
  readonly assets: readonly IndexedAsset[];
}

export class AssetIndex {
  #source: AssetSource;
  #byPath = new Map<string, IndexedAsset>();
  #byId = new Map<string, IndexedAsset>();

  constructor(
    source: AssetSource,
    entries: Iterable<IndexedAsset> = []
  ) {
    this.#source = source;
    for (const entry of entries) {
      this.set(entry);
    }
  }

  get size(): number {
    return this.#byPath.size;
  }

  set(
    entry: IndexedAsset
  ): this {
    const sameId = this.#byId.get(entry.id);
    if (sameId !== undefined) {
      this.#byPath.delete(sameId.path);
    }

    const samePath = this.#byPath.get(entry.path);
    if (samePath !== undefined) {
      this.#byId.delete(samePath.id);
    }

    const stored: IndexedAsset = {
      id: entry.id,
      path: entry.path,
      kind: entry.kind
    };
    this.#byPath.set(stored.path, stored);
    this.#byId.set(stored.id, stored);

    return this;
  }

  removeById(
    id: string
  ): boolean {
    const entry = this.#byId.get(id);
    if (entry === undefined) {
      return false;
    }

    this.#byId.delete(id);
    this.#byPath.delete(entry.path);

    return true;
  }

  byPath(
    path: string
  ): IndexedAsset | undefined {
    return this.#byPath.get(path);
  }

  byId(
    id: string
  ): IndexedAsset | undefined {
    return this.#byId.get(id);
  }

  [Symbol.iterator](): IterableIterator<IndexedAsset> {
    return this.#byId.values();
  }

  toJSON(): AssetIndexData {
    return {
      version: kIndexVersion,
      assets: [...this.#byId.values()].sort(
        (left, right) => kPathCollator.compare(left.path, right.path)
      )
    };
  }

  save(): Promise<void> {
    return writeJsonFile(
      this.#source,
      ASSET_INDEX_PATH,
      this.toJSON()
    );
  }

  static async load(
    source: AssetSource,
    logger: Logger = silentLogger()
  ): Promise<AssetIndex> {
    const entries = await readStateFile(
      source,
      ASSET_INDEX_PATH,
      AssetIndex.parse,
      logger
    );

    return new AssetIndex(
      source,
      entries
    );
  }

  static parse(
    input: unknown
  ): StateFileParse<IndexedAsset[]> {
    const parsed = kIndexParser.parse(input);
    if (!parsed.ok) {
      return {
        data: [],
        dropped: 0
      };
    }

    const { entries, dropped } = keepValid(
      parsed.val.assets.entries(),
      kEntryParser
    );

    return {
      data: entries.map(([, entry]) => entry),
      dropped
    };
  }
}
