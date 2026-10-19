// Import Internal Dependencies
import {
  Preferences,
  type PreferenceChange
} from "./Preferences.ts";
import type { PreferenceOverrides } from "../scope/PreferenceScope.ts";

// CONSTANTS
export const LOCAL_PREFERENCES_KEY_PREFIX = "jolly-pixel:preferences:";

export interface LocalPreferencesOptions {
  /**
   * `null` keeps the preferences in memory.
   * @default globalThis.localStorage
   */
  storage?: Storage | null;
}

export class LocalPreferences implements Disposable {
  readonly preferences: Preferences;

  #storage: Storage | null;
  #listening = new AbortController();

  constructor(
    options: LocalPreferencesOptions = {}
  ) {
    this.#storage = options.storage === undefined ?
      browserStorage() :
      options.storage;
    this.preferences = new Preferences({
      overrides: this.#read(),
      write: (change) => this.#write(change)
    });
    globalThis.window?.addEventListener("storage", this.#onStorage, {
      signal: this.#listening.signal
    });
  }

  [Symbol.dispose](): void {
    this.#listening.abort();
  }

  * #read(): IterableIterator<[string, PreferenceOverrides]> {
    if (this.#storage === null) {
      return;
    }

    for (let index = 0; index < this.#storage.length; index++) {
      const key = this.#storage.key(index);
      if (key?.startsWith(LOCAL_PREFERENCES_KEY_PREFIX)) {
        yield [
          key.slice(LOCAL_PREFERENCES_KEY_PREFIX.length),
          parseOverrides(this.#storage.getItem(key))
        ];
      }
    }
  }

  #write(
    change: PreferenceChange
  ): boolean {
    const key = LOCAL_PREFERENCES_KEY_PREFIX + change.scope;
    try {
      if (Object.keys(change.overrides).length === 0) {
        this.#storage?.removeItem(key);
      }
      else {
        this.#storage?.setItem(key, JSON.stringify(change.overrides));
      }

      return true;
    }
    catch {
      return false;
    }
  }

  readonly #onStorage = (
    event: StorageEvent
  ): void => {
    if (
      event.storageArea !== this.#storage ||
      !event.key?.startsWith(LOCAL_PREFERENCES_KEY_PREFIX)
    ) {
      return;
    }

    this.preferences.receive(
      event.key.slice(LOCAL_PREFERENCES_KEY_PREFIX.length),
      parseOverrides(event.newValue)
    );
  };
}

function browserStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  }
  catch {
    return null;
  }
}

function parseOverrides(
  text: string | null
): PreferenceOverrides {
  if (text === null) {
    return {};
  }

  try {
    const value: unknown = JSON.parse(text);

    return typeof value === "object" && value !== null && !Array.isArray(value) ?
      { ...value } :
      {};
  }
  catch {
    return {};
  }
}
