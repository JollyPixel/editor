// Import Internal Dependencies
import type { AssetCatalog } from "../AssetCatalog.ts";
import { AssetHandle } from "./AssetHandle.ts";
import { AssetId } from "../AssetId.ts";
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

/**
 * Resolves asset references and creates independent loading operations.
 */
export class AssetCoordinator {
  readonly catalog: AssetCatalog;
  readonly loaders: AssetLoaderRegistry;

  #store = new AssetStore();

  constructor(
    options: AssetCoordinatorOptions
  ) {
    this.catalog = options.catalog;
    this.loaders = options.loaders;
  }

  request<TValue>(
    reference: AssetReference<TValue>
  ): AssetHandle<TValue> {
    this.catalog.resolve(reference);

    return new AssetHandle(
      reference,
      this.#store
    );
  }

  get<TValue>(
    reference: AssetReference<TValue>
  ): TValue {
    this.catalog.resolve(reference);

    return this.#store.get(reference);
  }

  async load<TValue>(
    reference: AssetReference<TValue>,
    context: AssetLoadContext = {}
  ): Promise<TValue> {
    const record = this.catalog.resolve(reference);

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
    const tasks = new Map<string, AssetLoadBatchTask>();

    for (const reference of references) {
      const record = this.catalog.resolve(reference);
      const ready = this.#store.statusOf(
        reference
      ) === "ready";

      if (!tasks.has(record.id.value)) {
        tasks.set(record.id.value, {
          record,
          ready,
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
      tasks.values(),
      options
    );
  }

  evict(
    id: AssetId | string
  ): unknown | undefined {
    return this.#store.evict(
      AssetId.from(id)
    );
  }

  async #load<TValue>(
    reference: AssetReference<TValue>,
    record: AssetRecord,
    context: AssetLoadContext
  ): Promise<TValue> {
    const loader = this.loaders.get(reference.type);

    return this.#store.load(
      reference,
      () => loader.load(record, context)
    );
  }
}
