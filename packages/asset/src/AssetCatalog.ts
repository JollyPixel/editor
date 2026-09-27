// Import Third-party Dependencies
import * as z from "zod";

// Import Internal Dependencies
import { AssetId } from "./AssetId.ts";
import type { AssetReference } from "./AssetReference.ts";
import {
  AssetRecord,
  type AssetRecordData
} from "./AssetRecord.ts";
import { AssetAlreadyExistsError } from "./errors/AssetAlreadyExistsError.ts";
import { AssetKindMismatchError } from "./errors/AssetKindMismatchError.ts";
import { AssetNotFoundError } from "./errors/AssetNotFoundError.ts";
import {
  UnsupportedAssetManifestError
} from "./errors/UnsupportedAssetManifestError.ts";

// CONSTANTS
const kAssetManifestVersion = 1;
const kManifestVersionSchema = z.object({
  version: z.number()
});
const kManifestAssetsSchema = z.object({
  assets: z.array(z.unknown())
});

export interface AssetManifestData {
  readonly version: 1;
  readonly assets: readonly AssetRecordData[];
}

/**
 * Owns the persistent asset records for one project or session.
 */
export class AssetCatalog implements Iterable<AssetRecord> {
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
    if (this.has(record.id)) {
      throw new AssetAlreadyExistsError(
        record.id
      );
    }

    return this.set(record);
  }

  set(
    record: AssetRecord
  ): this {
    this.#records.set(
      record.id.value,
      record
    );

    return this;
  }

  has(
    id: AssetId | string
  ): boolean {
    return this.#records.has(
      AssetId.from(id).value
    );
  }

  find(
    id: AssetId | string
  ): AssetRecord | undefined {
    return this.#records.get(
      AssetId.from(id).value
    );
  }

  get(
    id: AssetId | string
  ): AssetRecord {
    const record = this.find(id);
    if (record === undefined) {
      throw new AssetNotFoundError(AssetId.from(id));
    }

    return record;
  }

  remove(
    id: AssetId | string
  ): AssetRecord {
    const record = this.get(id);
    this.#records.delete(record.id.value);

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
    const { version } = kManifestVersionSchema.parse(input);
    if (version !== kAssetManifestVersion) {
      throw new UnsupportedAssetManifestError(version);
    }

    const { assets } = kManifestAssetsSchema.parse(input);

    return new AssetCatalog(
      assets.map((record) => AssetRecord.parse(record))
    );
  }
}
