// Import Internal Dependencies
import type { AssetCatalog } from "../AssetCatalog.ts";
import { AssetHandle } from "./AssetHandle.ts";
import {
  type AssetLoadBatch,
  type AssetLoadBatchOptions,
  type AssetLoadBatchTask,
  startAssetLoadBatch
} from "./AssetLoadBatch.ts";
import type { AssetLoadContext } from "./AssetLoader.ts";
import type { AssetLoaderRegistry } from "./AssetLoaderRegistry.ts";
import type { AssetRecord } from "../AssetRecord.ts";
import type { AssetReference } from "../AssetReference.ts";
import { AssetStore } from "./AssetStore.ts";

export interface AssetCoordinatorOptions {
  catalog: AssetCatalog;
  loaders: AssetLoaderRegistry;
}

export class AssetCoordinator {
  #catalog: AssetCatalog;
  #loaders: AssetLoaderRegistry;
  #store = new AssetStore();

  constructor(
    options: AssetCoordinatorOptions
  ) {
    this.#catalog = options.catalog;
    this.#loaders = options.loaders;
  }

  request<TValue>(
    reference: AssetReference<TValue>
  ): AssetHandle<TValue> {
    this.#catalog.resolve(reference);

    return new AssetHandle(
      reference,
      this.#store
    );
  }

  get<TValue>(
    reference: AssetReference<TValue>
  ): TValue {
    this.#catalog.resolve(reference);

    return this.#store.get(reference);
  }

  async load<TValue>(
    reference: AssetReference<TValue>,
    context: AssetLoadContext = {}
  ): Promise<TValue> {
    const record = this.#catalog.resolve(reference);

    return this.#load(
      reference,
      record,
      context
    );
  }

  loadBatch(
    references: Iterable<AssetReference<unknown>>,
    options: AssetLoadBatchOptions = {}
  ): AssetLoadBatch {
    const context: AssetLoadContext = {
      signal: options.signal
    };
    const seen = new Set<string>();
    const pending: AssetLoadBatchTask[] = [];

    for (const reference of references) {
      const record = this.#catalog.resolve(reference);
      if (seen.has(record.id.value)) {
        continue;
      }

      seen.add(record.id.value);
      if (this.#store.loadStatus(reference) !== "ready") {
        pending.push({
          record,
          load: async() => {
            await this.#load(
              reference,
              record,
              context
            );
          }
        });
      }
    }

    return startAssetLoadBatch(
      pending,
      seen.size,
      options
    );
  }

  evict<TValue>(
    reference: AssetReference<TValue>
  ): TValue | undefined {
    return this.#store.evict(reference);
  }

  async #load<TValue>(
    reference: AssetReference<TValue>,
    record: AssetRecord,
    context: AssetLoadContext
  ): Promise<TValue> {
    const loader = this.#loaders.get(reference.type);

    return this.#store.load(
      reference,
      () => loader.load(record, context)
    );
  }
}
