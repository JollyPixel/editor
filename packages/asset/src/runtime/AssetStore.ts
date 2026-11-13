// Import Internal Dependencies
import type { AssetReference } from "../AssetReference.ts";
import { AssetNotReadyError } from "../errors/AssetNotReadyError.ts";

interface LoadingAssetStoreEntry<TValue> {
  readonly status: "loading";
  readonly promise: Promise<TValue>;
}

interface ReadyAssetStoreEntry<TValue> {
  readonly status: "ready";
  readonly value: TValue;
}

interface FailedAssetStoreEntry {
  readonly status: "failed";
  readonly error: unknown;
}

type AssetStoreEntry<TValue> =
  | LoadingAssetStoreEntry<TValue>
  | ReadyAssetStoreEntry<TValue>
  | FailedAssetStoreEntry;

export type AssetStatus =
  | "unloaded"
  | AssetStoreEntry<unknown>["status"];

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
      status: "loading",
      promise: Promise.resolve()
        .then(load)
        .then(
          (value) => {
            this.#settle(key, loading, {
              status: "ready",
              value
            });

            return value;
          },
          (error: unknown) => {
            this.#settle(key, loading, {
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
    return this.#entries.get(
      reference.id.value
    ) as AssetStoreEntry<TValue> | undefined;
  }
}
