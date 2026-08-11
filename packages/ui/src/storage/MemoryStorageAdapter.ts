// Import Internal Dependencies
import type { StorageAdapter } from "./StorageAdapter.ts";

/**
 * In-memory storage and `LocalStorageAdapter` fallback.
 */
export class MemoryStorageAdapter implements StorageAdapter {
  #values = new Map<string, string>();

  get(
    key: string
  ): string | null {
    return this.#values.get(key) ?? null;
  }

  set(
    key: string,
    value: string
  ): void {
    this.#values.set(key, value);
  }
}
