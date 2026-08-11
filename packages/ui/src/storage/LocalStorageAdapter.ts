// Import Internal Dependencies
import type { StorageAdapter } from "./StorageAdapter.ts";
import { MemoryStorageAdapter } from "./MemoryStorageAdapter.ts";

/**
 * The `Storage` API used by this package.
 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(
    key: string,
    value: string
  ): void;
}

export interface LocalStorageAdapterOptions {
  /**
   * Resolves storage inside a `try` for sandboxed iframes.
   */
  resolve?: () => StorageLike | undefined;
}

function resolveGlobalStorage(): StorageLike | undefined {
  return globalThis.localStorage;
}

function isStorageLike(
  value: unknown
): value is StorageLike {
  return typeof value === "object" &&
    value !== null &&
    "getItem" in value &&
    typeof value.getItem === "function";
}

/**
 * Wraps `localStorage` and permanently falls back to memory after a failure.
 */
export class LocalStorageAdapter implements StorageAdapter {
  #fallback = new MemoryStorageAdapter();
  #storage: StorageLike | null = null;

  constructor(
    options: LocalStorageAdapterOptions = {}
  ) {
    const { resolve = resolveGlobalStorage } = options;

    try {
      const storage = resolve();
      this.#storage = isStorageLike(storage) ? storage : null;
    }
    catch {
      this.#storage = null;
    }
  }

  /**
   * Whether writes reach `localStorage`.
   */
  get persistent() {
    return this.#storage !== null;
  }

  get(
    key: string
  ): string | null {
    if (this.#storage !== null) {
      try {
        return this.#storage.getItem(key);
      }
      catch {
        this.#storage = null;
      }
    }

    return this.#fallback.get(key);
  }

  set(
    key: string,
    value: string
  ): void {
    this.#fallback.set(key, value);
    if (this.#storage === null) {
      return;
    }

    try {
      this.#storage.setItem(key, value);
    }
    catch {
      this.#storage = null;
    }
  }
}
