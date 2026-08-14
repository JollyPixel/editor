// Import Internal Dependencies
import type { AssetCatalog } from "../AssetCatalog.ts";
import type { AssetHandle } from "./AssetHandle.ts";
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
import {
  AssetStore
} from "./AssetStore.ts";

export interface AssetCoordinatorOptions {
  catalog: AssetCatalog;
  loaders: AssetLoaderRegistry;
  store?: AssetStore;
}

/**
 * Resolves asset references and creates independent loading operations.
 */
export class AssetCoordinator {
  readonly catalog: AssetCatalog;
  readonly loaders: AssetLoaderRegistry;
  readonly store: AssetStore;

  constructor(
    options: AssetCoordinatorOptions
  ) {
    this.catalog = options.catalog;
    this.loaders = options.loaders;
    this.store = options.store ?? new AssetStore();
  }

  request<TValue>(
    reference: AssetReference<TValue>
  ): AssetHandle<TValue> {
    this.catalog.resolve(reference);

    return this.store.request(reference);
  }

  get<TValue>(
    reference: AssetReference<TValue>
  ): TValue {
    this.catalog.resolve(reference);

    return this.store.get(reference);
  }

  async load<TValue>(
    reference: AssetReference<TValue>,
    options: AssetLoadContext = {}
  ): Promise<TValue> {
    const record = this.catalog.resolve(reference);

    return this.#loadResolved(
      reference,
      record,
      options
    );
  }

  loadBatch(
    references: Iterable<AssetReference<unknown>>,
    options: AssetLoadBatchOptions = {}
  ): AssetLoadBatch {
    const dependencies = new Map<string, AssetLoadBatchTask>();

    for (const reference of references) {
      const record = this.catalog.resolve(reference);
      this.store.request(reference);

      if (!dependencies.has(reference.id.value)) {
        const task = {
          record,
          ready: this.store.statusOf(reference) === "ready",
          load: async() => {
            await this.#loadResolved(
              reference,
              record,
              {}
            );
          }
        };

        dependencies.set(
          reference.id.value,
          task
        );
      }
    }

    return startAssetLoadBatch(
      dependencies.values(),
      options
    );
  }

  async #loadResolved<TValue>(
    reference: AssetReference<TValue>,
    record: AssetRecord,
    context: AssetLoadContext
  ): Promise<TValue> {
    const loader = this.loaders.get(reference.type);

    return this.store.load(
      reference,
      () => loader.load(record, context)
    );
  }
}
