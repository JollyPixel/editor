// Import Third-party Dependencies
import type { AssetRecord } from "@jolly-pixel/asset";
import {
  Ok,
  type Result
} from "@openally/result";
import { LRUCache } from "lru-cache";
import { InFlight } from "@jolly-pixel/utils";

// Import Internal Dependencies
import type { AssetStates } from "./AssetStates.ts";

export interface RevisionCacheOptions<T> {
  assets: AssetStates;
  maxBytes: number;
  measure(
    value: T
  ): number;
}

interface CachedRevision<T> {
  readonly revision: string | undefined;
  readonly value: T;
}

export class RevisionCache<T> {
  #assets: AssetStates;
  #cached: LRUCache<string, CachedRevision<T>>;
  #pending = new InFlight<Result<T, Error>>();

  constructor(
    options: RevisionCacheOptions<T>
  ) {
    const { measure } = options;

    this.#assets = options.assets;
    this.#cached = new LRUCache({
      maxSize: options.maxBytes,
      sizeCalculation: (cached) => Math.max(1, measure(cached.value))
    });
  }

  resolve(
    record: AssetRecord,
    work: () => Promise<Result<T, Error>>
  ): Promise<Result<T, Error>> {
    const assetId = record.id.value;
    const { revision } = record;
    const cached = this.#cached.get(assetId);
    if (cached !== undefined && cached.revision === revision) {
      return Promise.resolve(Ok(cached.value));
    }

    return this.#pending.run(`${assetId}@${revision ?? ""}`, async() => {
      const result = await work();
      if (result.ok && this.#assets.isCurrent(record)) {
        this.#cached.set(assetId, {
          revision,
          value: result.val
        });
      }

      return result;
    });
  }
}
