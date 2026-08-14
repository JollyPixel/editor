// Import Internal Dependencies
import type { AssetReference } from "../AssetReference.ts";
import type {
  AssetStatus,
  AssetStore
} from "./AssetStore.ts";

/**
 * Provides synchronous typed access to one entry in an AssetStore.
 */
export class AssetHandle<
  TValue = unknown
> {
  readonly reference: AssetReference<TValue>;

  #store: AssetStore;

  constructor(
    reference: AssetReference<TValue>,
    store: AssetStore
  ) {
    this.reference = reference;
    this.#store = store;
  }

  get status(): AssetStatus {
    return this.#store.statusOf(
      this.reference
    );
  }

  get error(): unknown | undefined {
    return this.#store.errorOf(
      this.reference
    );
  }

  get(): TValue {
    return this.#store.get(
      this.reference
    );
  }
}
