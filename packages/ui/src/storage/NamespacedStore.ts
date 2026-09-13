// Import Internal Dependencies
import type { StorageAdapter } from "./StorageAdapter.ts";

export interface NamespacedStoreOptions {
  namespace(): string;
  storage(): StorageAdapter;
  isManaged?(): boolean;
  onManagedWrite?(): void;
}

export class NamespacedStore {
  readonly #options: NamespacedStoreOptions;

  constructor(
    options: NamespacedStoreOptions
  ) {
    this.#options = options;
  }

  get managed(): boolean {
    return this.#options.isManaged?.() ?? false;
  }

  read(
    key: string
  ): string | null {
    const namespace = this.#options.namespace();
    if (this.managed || namespace === "") {
      return null;
    }

    return this.#options.storage().get(`${namespace}:${key}`);
  }

  readBoolean(
    key: string
  ): boolean | null {
    const value = this.read(key);
    if (value === "true" || value === "false") {
      return value === "true";
    }

    return null;
  }

  readNumber(
    key: string
  ): number | null {
    const value = this.read(key);
    if (value === null || value.trim() === "") {
      return null;
    }

    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  readJson(
    key: string
  ): unknown {
    const value = this.read(key);
    if (value === null) {
      return null;
    }

    try {
      return JSON.parse(value);
    }
    catch {
      return null;
    }
  }

  write(
    key: string,
    value: string
  ): void {
    if (this.managed) {
      this.#options.onManagedWrite?.();

      return;
    }

    const namespace = this.#options.namespace();
    if (namespace !== "") {
      this.#options.storage().set(`${namespace}:${key}`, value);
    }
  }

  writeBoolean(
    key: string,
    value: boolean
  ): void {
    this.write(key, String(value));
  }

  writeNumber(
    key: string,
    value: number
  ): void {
    this.write(key, String(value));
  }

  writeJson(
    key: string,
    value: unknown
  ): void {
    this.write(key, JSON.stringify(value));
  }
}
