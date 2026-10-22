// Import Internal Dependencies
import type { AssetReference } from "../AssetReference.ts";
import type { AssetType } from "../AssetType.ts";
import type { AssetStatus } from "./AssetHandle.ts";
import { AssetNotReadyError } from "../errors/AssetNotReadyError.ts";
import { AssetTypeMismatchError } from "../errors/AssetTypeMismatchError.ts";

interface AssetStoreEntryBase<TValue> {
  readonly type: AssetType<TValue>;
}

interface LoadingAssetStoreEntry<TValue>
  extends AssetStoreEntryBase<TValue> {
  readonly status: "loading";
  readonly promise: Promise<TValue>;
}

interface ReadyAssetStoreEntry<TValue>
  extends AssetStoreEntryBase<TValue> {
  readonly status: "ready";
  readonly value: TValue;
}

interface FailedAssetStoreEntry<TValue>
  extends AssetStoreEntryBase<TValue> {
  readonly status: "failed";
  readonly error: unknown;
}

type AssetStoreEntry<TValue> =
  | LoadingAssetStoreEntry<TValue>
  | ReadyAssetStoreEntry<TValue>
  | FailedAssetStoreEntry<TValue>;

export class AssetStore {
  #entries = new Map<
    string,
    AssetStoreEntry<unknown>
  >();

  loadStatus(
    reference: AssetReference<unknown>
  ): AssetStatus {
    return this.#findEntry(
      reference
    )?.status ?? "unloaded";
  }

  loadError(
    reference: AssetReference<unknown>
  ): unknown | undefined {
    const entry = this.#findEntry(reference);

    return entry?.status === "failed" ?
      entry.error :
      undefined;
  }

  get<TValue>(
    reference: AssetReference<TValue>
  ): TValue {
    const entry = this.#findEntry(reference);
    if (entry?.status !== "ready") {
      throw new AssetNotReadyError(
        reference.id,
        entry?.status ?? "unloaded"
      );
    }

    return entry.value;
  }

  async load<TValue>(
    reference: AssetReference<TValue>,
    load: () => Promise<TValue>
  ): Promise<TValue> {
    const entry = this.#findEntry(reference);
    if (entry?.status === "ready") {
      return entry.value;
    }
    if (entry?.status === "loading") {
      return entry.promise;
    }

    const key = reference.id.value;
    const loading: LoadingAssetStoreEntry<TValue> = {
      type: reference.type,
      status: "loading",
      promise: Promise.resolve()
        .then(load)
        .then(
          (value) => {
            this.#settle(key, loading, {
              type: reference.type,
              status: "ready",
              value
            });

            return value;
          },
          (error: unknown) => {
            this.#settle(key, loading, {
              type: reference.type,
              status: "failed",
              error
            });

            throw error;
          }
        )
    };
    this.#entries.set(key, loading);

    return loading.promise;
  }

  evict<TValue>(
    reference: AssetReference<TValue>
  ): TValue | undefined {
    const entry = this.#findEntry(reference);
    this.#entries.delete(reference.id.value);

    return entry?.status === "ready" ?
      entry.value :
      undefined;
  }

  #settle(
    key: string,
    loading: AssetStoreEntry<unknown>,
    settled: AssetStoreEntry<unknown>
  ): void {
    if (this.#entries.get(key) === loading) {
      this.#entries.set(key, settled);
    }
  }

  #findEntry<TValue>(
    reference: AssetReference<TValue>
  ): AssetStoreEntry<TValue> | undefined {
    const entry = this.#entries.get(reference.id.value);
    if (entry === undefined) {
      return undefined;
    }
    if (entry.type !== reference.type) {
      throw new AssetTypeMismatchError(reference.kind);
    }

    return entry as AssetStoreEntry<TValue>;
  }
}
