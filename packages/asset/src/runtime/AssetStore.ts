// Import Internal Dependencies
import { AssetHandle } from "./AssetHandle.ts";
import type { AssetId } from "../AssetId.ts";
import type { AssetReference } from "../AssetReference.ts";
import type { AssetType } from "../AssetType.ts";
import {
  AssetKindMismatchError
} from "../errors/AssetKindMismatchError.ts";
import { AssetNotReadyError } from "../errors/AssetNotReadyError.ts";
import { AssetTypeMismatchError } from "../errors/AssetTypeMismatchError.ts";

export type AssetStatus =
  | "unloaded"
  | "loading"
  | "ready"
  | "failed";

interface AssetStoreEntryBase<TValue> {
  readonly type: AssetType<TValue>;
}

interface UnloadedAssetStoreEntry<TValue>
  extends AssetStoreEntryBase<TValue> {
  readonly status: "unloaded";
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
  | UnloadedAssetStoreEntry<TValue>
  | LoadingAssetStoreEntry<TValue>
  | ReadyAssetStoreEntry<TValue>
  | FailedAssetStoreEntry<TValue>;

/**
 * Owns loaded values and in-flight operations for one runtime scope.
 */
export class AssetStore {
  #entries = new Map<string, AssetStoreEntry<unknown>>();

  get size(): number {
    return this.#entries.size;
  }

  request<TValue>(
    reference: AssetReference<TValue>
  ): AssetHandle<TValue> {
    this.#entryFor(reference);

    return new AssetHandle(
      reference,
      this
    );
  }

  statusOf(
    reference: AssetReference<unknown>
  ): AssetStatus {
    return this.#entryFor(reference).status;
  }

  errorOf(
    reference: AssetReference<unknown>
  ): unknown | undefined {
    const entry = this.#entryFor(reference);

    return entry.status === "failed" ?
      entry.error :
      undefined;
  }

  get<TValue>(
    reference: AssetReference<TValue>
  ): TValue {
    const entry = this.#entryFor(reference);
    if (entry.status !== "ready") {
      throw new AssetNotReadyError(
        reference.id,
        entry.status
      );
    }

    return entry.value;
  }

  async load<TValue>(
    reference: AssetReference<TValue>,
    load: () => Promise<TValue>
  ): Promise<TValue> {
    const entry = this.#entryFor(reference);
    if (entry.status === "ready") {
      return entry.value;
    }
    if (entry.status === "loading") {
      return entry.promise;
    }

    const key = reference.id.value;
    const promise = Promise.resolve()
      .then(load)
      .then((value) => {
        const current = this.#entries.get(key);
        if (
          current?.status === "loading" &&
          current.promise === promise
        ) {
          this.#entries.set(key, {
            type: reference.type,
            status: "ready",
            value
          });
        }

        return value;
      })
      .catch((error: unknown) => {
        const current = this.#entries.get(key);
        if (
          current?.status === "loading" &&
          current.promise === promise
        ) {
          this.#entries.set(key, {
            type: reference.type,
            status: "failed",
            error
          });
        }

        throw error;
      });
    this.#entries.set(key, {
      type: reference.type,
      status: "loading",
      promise
    });

    return promise;
  }

  clear(): void {
    this.#entries.clear();
  }

  evict(
    id: AssetId
  ): unknown | undefined {
    const entry = this.#entries.get(id.value);
    this.#entries.delete(id.value);

    return entry?.status === "ready" ?
      entry.value :
      undefined;
  }

  #entryFor<TValue>(
    reference: AssetReference<TValue>
  ): AssetStoreEntry<TValue> {
    const key = reference.id.value;

    const existing = this.#entries.get(key);
    if (existing !== undefined) {
      if (existing.type.kind !== reference.kind) {
        throw new AssetKindMismatchError(
          reference.id,
          reference.kind,
          existing.type.kind
        );
      }
      if (existing.type !== reference.type) {
        throw new AssetTypeMismatchError(reference.kind);
      }

      // Token identity recovers TValue after heterogeneous map storage.
      return existing as AssetStoreEntry<TValue>;
    }

    const entry: AssetStoreEntry<TValue> = {
      type: reference.type,
      status: "unloaded"
    };
    this.#entries.set(key, entry);

    return entry;
  }
}
