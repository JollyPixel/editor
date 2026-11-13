// Import Internal Dependencies
import type { AssetCatalog } from "../AssetCatalog.ts";
import { AssetHandle } from "./AssetHandle.ts";
import {
  AssetLoadBatch,
  type AssetLoadBatchOptions,
  type AssetLoadBatchTask
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
  #context: AssetLoadContext;

  constructor(
    options: AssetCoordinatorOptions
  ) {
    this.#catalog = options.catalog;
    this.#loaders = options.loaders;
    this.#context = {
      assets: {
        catalog: this.#catalog,
        load: (reference) => this.load(reference)
      }
    };
  }

  canLoad(
    reference: AssetReference<unknown>
  ): boolean {
    return this.#catalog.find(reference.id)?.hasKind(reference.kind) === true &&
      this.#loaders.has(reference.type);
  }

  request<TValue>(
    reference: AssetReference<TValue>
  ): AssetHandle<TValue> {
    this.#resolve(reference);

    return new AssetHandle(
      reference,
      this.#store
    );
  }

  get<TValue>(
    reference: AssetReference<TValue>
  ): TValue {
    this.#resolve(reference);

    return this.#store.get(reference);
  }

  async load<TValue>(
    reference: AssetReference<TValue>
  ): Promise<TValue> {
    return this.#load(
      reference,
      this.#resolve(reference)
    );
  }

  loadBatch(
    references: Iterable<AssetReference<unknown>>,
    options: AssetLoadBatchOptions = {}
  ): AssetLoadBatch {
    const seen = new Set<string>();
    const pending: AssetLoadBatchTask[] = [];

    for (const reference of references) {
      const record = this.#resolve(reference);
      if (seen.has(record.id.value)) {
        continue;
      }

      seen.add(record.id.value);
      if (this.#store.loadStatus(reference) !== "ready") {
        pending.push({
          record,
          load: async() => {
            await this.#load(reference, record);
          }
        });
      }
    }

    return new AssetLoadBatch(
      pending,
      seen.size,
      options
    );
  }

  evict<TValue>(
    reference: AssetReference<TValue>
  ): TValue | undefined {
    this.#loaders.find(reference.type);

    return this.#store.evict(reference);
  }

  #resolve(
    reference: AssetReference<unknown>
  ): AssetRecord {
    const record = this.#catalog.resolve(reference);
    this.#loaders.find(reference.type);

    return record;
  }

  async #load<TValue>(
    reference: AssetReference<TValue>,
    record: AssetRecord
  ): Promise<TValue> {
    const loader = this.#loaders.get(reference.type);

    return this.#store.load(
      reference,
      () => loader.load(record, this.#context)
    );
  }
}
