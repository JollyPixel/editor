// Import Internal Dependencies
import { AssetId } from "./AssetId.ts";
import type { AssetReference } from "./AssetReference.ts";
import {
  AssetRecord,
  type AssetRecordData
} from "./AssetRecord.ts";
import { AssetAlreadyExistsError } from "./errors/AssetAlreadyExistsError.ts";
import { AssetKindMismatchError } from "./errors/AssetKindMismatchError.ts";
import {
  AssetKindNotFoundError
} from "./errors/AssetKindNotFoundError.ts";
import { AssetNotFoundError } from "./errors/AssetNotFoundError.ts";
import {
  UnsupportedAssetManifestError
} from "./errors/UnsupportedAssetManifestError.ts";
import { AssetFetchError } from "./errors/AssetFetchError.ts";
import {
  CATALOG_URL_PATH
} from "./urls.ts";

// CONSTANTS
const kAssetManifestVersion = 1;

export interface AssetManifestData {
  readonly version: 1;
  readonly assets: readonly AssetRecordData[];
}

/**
 * Owns the persistent asset records for one project or session.
 */
export class AssetCatalog implements Iterable<AssetRecord> {
  static async fetch(
    url = CATALOG_URL_PATH
  ): Promise<AssetCatalog> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new AssetFetchError(
        url,
        response.status
      );
    }

    return AssetCatalog.parse(
      await response.json()
    );
  }

  #records = new Map<string, AssetRecord>();

  constructor(
    records: Iterable<AssetRecord> = []
  ) {
    for (const record of records) {
      this.add(record);
    }
  }

  get size(): number {
    return this.#records.size;
  }

  add(
    record: AssetRecord
  ): this {
    const key = record.id.value;
    if (this.#records.has(key)) {
      throw new AssetAlreadyExistsError(record.id);
    }

    this.#records.set(key, record);

    return this;
  }

  has(
    id: AssetId
  ): boolean {
    return this.#records.has(id.value);
  }

  replace(
    record: AssetRecord
  ): this {
    this.get(record.id);
    this.#records.set(
      record.id.value,
      record
    );

    return this;
  }

  remove(
    id: AssetId
  ): AssetRecord {
    const record = this.get(id);
    this.#records.delete(id.value);

    return record;
  }

  get(
    id: AssetId
  ): AssetRecord {
    const record = this.#records.get(id.value);
    if (record === undefined) {
      throw new AssetNotFoundError(id);
    }

    return record;
  }

  * byKind(
    kind: string
  ): IterableIterator<AssetRecord> {
    for (const record of this.#records.values()) {
      if (record.kind === kind) {
        yield record;
      }
    }
  }

  firstOfKind(
    kind: string
  ): AssetRecord {
    const first = this.byKind(kind).next();
    if (first.done === true) {
      throw new AssetKindNotFoundError(kind);
    }

    return first.value;
  }

  resolve(
    reference: AssetReference<unknown>
  ): AssetRecord {
    const record = this.get(reference.id);
    if (record.kind !== reference.kind) {
      throw new AssetKindMismatchError(
        reference.id,
        reference.kind,
        record.kind
      );
    }

    return record;
  }

  [Symbol.iterator](): IterableIterator<AssetRecord> {
    return this.#records.values();
  }

  toJSON(): AssetManifestData {
    return {
      version: kAssetManifestVersion,
      assets: Array.from(
        this.#records.values(),
        (record) => record.toJSON()
      )
    };
  }

  static parse(
    input: unknown
  ): AssetCatalog {
    if (
      typeof input !== "object" ||
      input === null ||
      Array.isArray(input)
    ) {
      throw new TypeError("Asset manifest must be an object.");
    }
    if (
      !("version" in input) ||
      typeof input.version !== "number"
    ) {
      throw new TypeError("Asset manifest version must be a number.");
    }
    if (
      input.version !== kAssetManifestVersion
    ) {
      throw new UnsupportedAssetManifestError(input.version);
    }
    if (
      !("assets" in input) ||
      !Array.isArray(input.assets)
    ) {
      throw new TypeError("Asset manifest assets must be an array.");
    }

    return new AssetCatalog(
      input.assets.map((record) => AssetRecord.parse(record))
    );
  }
}
