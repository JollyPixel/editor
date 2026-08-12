// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";

// Import Internal Dependencies
import type {
  StorageAdapter
} from "./StorageAdapter.ts";

export interface PersistedStateOptions {
  isManaged(): boolean;
  namespace(): string;
  storage(): StorageAdapter;
  onManagedWrite(): void;
}

/**
 * Routes an element's local state to its owner layout when one is present.
 */
export class PersistedState implements ReactiveController {
  readonly #options: PersistedStateOptions;

  constructor(
    host: ReactiveControllerHost,
    options: PersistedStateOptions
  ) {
    host.addController(this);
    this.#options = options;
  }

  get managed(): boolean {
    return this.#options.isManaged();
  }

  hostConnected(): void {
    // The controller resolves storage lazily because element properties may
    // arrive after construction and before connection.
  }

  read(
    key: string
  ): string | null {
    if (this.managed) {
      return null;
    }

    return this.#options.storage().get(
      this.#key(key)
    );
  }

  write(
    key: string,
    value: string
  ): void {
    if (this.managed) {
      this.#options.onManagedWrite();

      return;
    }

    this.#options.storage().set(
      this.#key(key),
      value
    );
  }

  #key(
    key: string
  ): string {
    return `${this.#options.namespace()}:${key}`;
  }
}
