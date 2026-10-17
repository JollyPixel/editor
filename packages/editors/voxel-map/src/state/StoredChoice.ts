// Import Third-party Dependencies
import {
  MemoryStorageAdapter,
  type StorageAdapter
} from "@jolly-pixel/ui";
import { Emitter } from "@openally/emitt";

export type StoredChoiceEvents<T extends string> = {
  change: (value: T) => void;
};

export interface StoredChoiceOptions<T extends string> {
  key: string;
  values: readonly T[];
  fallback: NoInfer<T>;
  storage?: StorageAdapter;
}

export class StoredChoice<T extends string> extends Emitter<StoredChoiceEvents<T>> {
  readonly values: readonly T[];

  #key: string;
  #storage: StorageAdapter;
  #value: T;

  constructor(
    options: StoredChoiceOptions<T>
  ) {
    super();

    const {
      key,
      values,
      fallback,
      storage = new MemoryStorageAdapter()
    } = options;
    const stored = storage.get(key);

    this.values = values;
    this.#key = key;
    this.#storage = storage;
    this.#value = values.find((value) => value === stored) ?? fallback;
  }

  get value(): T {
    return this.#value;
  }

  set value(
    value: T
  ) {
    if (value === this.#value) {
      return;
    }

    this.#value = value;
    this.#storage.set(this.#key, value);
    this.emit("change", value);
  }
}
